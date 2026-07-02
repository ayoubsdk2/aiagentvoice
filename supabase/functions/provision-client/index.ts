// Admin-triggered LIVE Account provisioning (synchronous, shared multi-tenant).
//
// Every LIVE customer shares ONE of two existing Retell base agents. We do NOT
// clone or create new Retell agents. Per line:
//   1. Buy a Telnyx number matching the requested area code.
//   2. Attach it to our Telnyx SIP Connection.
//   3. Import the number into Retell and bind it to the correct SHARED base
//      agent (Document Solutions -> agent_33d6…, else agent_281c…).
//   4. Persist customers -> live_accounts -> live_account_agents ->
//      live_account_phone_numbers so the admin UI sees the account
//      immediately in the global company dropdown and every tab.
// Per-customer prompt/variables are injected at call time via
// dynamic_variables (see retell-inbound). Nothing here mints a Retell agent.
//
// The whole batch is rolled back atomically on any failure (Telnyx release +
// Retell delete-phone-number).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { createLogger } from "../_shared/secure-logger.ts";
import {
  searchNumberByAreaCode, purchaseNumber, attachToConnection,
  releaseNumber, getPhoneNumberIdByE164,
} from "../_shared/telnyx-api.ts";
import { importPhoneNumber, deletePhoneNumber } from "../_shared/retell-api.ts";
import { resolveBaseAgentId } from "../_shared/live-agent-defaults.ts";

const log = createLogger("provision-client");

const LineSchema = z.object({
  label: z.string().min(1).max(80),
  area_code: z.string().regex(/^\d{3}$/),
  routing_type: z.enum(["unique", "duplicate"]),
  industry_id: z.string().min(1).max(80).optional(),
  system_prompt: z.string().max(20000).optional(),
});

const PayloadSchema = z.object({
  company_name:  z.string().min(1).max(200),
  contact_name:  z.string().min(1).max(200),
  website_url:   z.string().url().max(500),
  email_address: z.string().email().max(255),
  lines: z.array(LineSchema).min(1).max(10),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function authorize(req: Request): Promise<boolean> {
  const tok = req.headers.get("x-service-token");
  if (tok && tok === Deno.env.get("SERVICE_API_KEY")) return true;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const verify = await fetch(`${SUPABASE_URL}/functions/v1/admin-gate?action=verify`, {
    headers: { Authorization: auth },
  });
  return verify.ok;
}

type Resource =
  | { kind: "telnyx_number"; id: string }
  | { kind: "retell_phone"; e164: string }
  | { kind: "db_live_account"; id: string }
  | { kind: "db_agent"; id: string }
  | { kind: "db_phone"; id: string };

async function rollback(resources: Resource[]) {
  for (let i = resources.length - 1; i >= 0; i--) {
    const r = resources[i];
    try {
      if (r.kind === "telnyx_number")   await releaseNumber(r.id);
      else if (r.kind === "retell_phone") await deletePhoneNumber(r.e164);
      else if (r.kind === "db_phone")     await admin.from("live_account_phone_numbers").delete().eq("id", r.id);
      else if (r.kind === "db_agent")     await admin.from("live_account_agents").delete().eq("id", r.id);
      else if (r.kind === "db_live_account") await admin.from("live_accounts").delete().eq("id", r.id);
    } catch (err) {
      log.warn("rollback step failed", { resource: r, err: String(err) });
    }
  }
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomAccessCode(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  if (!(await authorize(req))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid_payload", issues: parsed.error.flatten() }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const connectionId = Deno.env.get("TELNYX_CONNECTION_ID");
  if (!connectionId) {
    return new Response(JSON.stringify({ error: "config_missing", detail: "TELNYX_CONNECTION_ID not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // BYO SIP trunk connecting Telnyx <-> Retell. Termination URI defaults to
  // Telnyx's standard FQDN so import-phone-number never 400s on a missing
  // field; trunk auth is optional (many trunks are IP-authenticated).
  const terminationUri = Deno.env.get("TELNYX_SIP_TERMINATION_URI") ?? "sip.telnyx.com";
  const trunkUser = Deno.env.get("TELNYX_SIP_TRUNK_USERNAME") || undefined;
  const trunkPass = Deno.env.get("TELNYX_SIP_TRUNK_PASSWORD") || undefined;

  const p = parsed.data;
  const inboundWebhookUrl = `${SUPABASE_URL}/functions/v1/retell-inbound`;

  // 1. Customer (create or reuse by exact-ish match)
  let customerId: string;
  {
    const { data: existing } = await admin
      .from("customers").select("id").ilike("name", p.company_name).maybeSingle();
    if (existing?.id) {
      customerId = existing.id as string;
    } else {
      const { data: created, error } = await admin
        .from("customers").insert({ name: p.company_name }).select("id").single();
      if (error || !created) {
        log.error("customer_create_failed", { err: error?.message });
        return new Response(JSON.stringify({ error: "customer_create_failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      customerId = created.id as string;
    }
  }

  const created: Resource[] = [];
  const resultLines: Array<{
    label: string; e164: string; retell_agent_id: string; routing_type: string;
    industry_id: string; base_agent_id: string;
  }> = [];

  let primaryAgentDbId: string | null = null;
  let primaryIndustryId: string | null = null;
  let primaryCustomInstructions: string | null = null;

  try {
    for (let i = 0; i < p.lines.length; i++) {
      const line = p.lines[i];
      const isFirst = i === 0;

      // Determine which line's config this line uses.
      const lineIndustryId = (isFirst || line.routing_type === "unique")
        ? (line.industry_id ?? "document-solutions")
        : (primaryIndustryId ?? "document-solutions");
      const lineCustomInstructions = (isFirst || line.routing_type === "unique")
        ? (line.system_prompt ?? null)
        : primaryCustomInstructions;
      const baseAgentId = resolveBaseAgentId(lineIndustryId);

      // Telnyx: search + purchase + attach to our SIP connection.
      const avail = await searchNumberByAreaCode(line.area_code);
      if (!avail) throw new Error(`no_inventory_for_area_code:${line.area_code}`);
      const purchased = await purchaseNumber(avail.phone_number);
      const phoneNumberId = await getPhoneNumberIdByE164(purchased.phone_number);
      created.push({ kind: "telnyx_number", id: phoneNumberId });
      await attachToConnection(phoneNumberId, connectionId);

      // Retell: import the number and bind it to the SHARED base agent.
      // NEVER creates or clones a Retell agent.
      await importPhoneNumber({
        phone_number: purchased.phone_number,
        termination_uri: terminationUri,
        sip_trunk_auth_username: trunkUser,
        sip_trunk_auth_password: trunkPass,
        nickname: `${p.company_name} · ${line.label}`,
        inbound_agent_id: baseAgentId,
        outbound_agent_id: baseAgentId,
        inbound_webhook_url: inboundWebhookUrl,
      });
      created.push({ kind: "retell_phone", e164: purchased.phone_number });

      // Persist the live_account row on the first line (one per customer).
      if (isFirst) {
        const { data: existingLA } = await admin
          .from("live_accounts").select("id").eq("customer_id", customerId).maybeSingle();
        if (existingLA?.id) {
          const { error: upErr } = await admin.from("live_accounts").update({
            display_name: p.company_name,
            contact_name: p.contact_name,
            contact_email: p.email_address,
            website_url: p.website_url,
            notification_email: p.email_address,
            vapi_assistant_id_primary: baseAgentId,
            provisioning_status: "succeeded",
            provisioning_error: null,
            needs_manual_review: false,
            is_active: true,
          }).eq("id", existingLA.id);
          if (upErr) throw new Error(`live_accounts_update_failed:${upErr.message}`);
        } else {
          const accessCode = randomAccessCode();
          const { data: insLA, error: insErr } = await admin.from("live_accounts").insert({
            customer_id: customerId,
            display_name: p.company_name,
            contact_name: p.contact_name,
            contact_email: p.email_address,
            website_url: p.website_url,
            notification_email: p.email_address,
            vapi_assistant_id_primary: baseAgentId,
            access_code_hash: await sha256Hex(accessCode),
            provisioning_status: "succeeded",
            is_active: true,
          }).select("id").single();
          if (insErr || !insLA) throw new Error(`live_accounts_insert_failed:${insErr?.message ?? "unknown"}`);
          created.push({ kind: "db_live_account", id: insLA.id });
        }
      }

      // Build the dynamic_variables contract Retell will inject at call time.
      // We persist real values (never REPLACE_ME) so retell-inbound can serve
      // them without any additional lookups. Optional integration/base URLs
      // fall back to blanks — admins fill them in per-customer via the UI.
      const assistantName = "Phoebe";
      const dynamicVars: Record<string, string> = {
        company_name: p.company_name,
        assistant_name: assistantName,
        vip_greeting: "",
        custom_instructions: lineCustomInstructions ?? "",
        integration_base_url: Deno.env.get("INTEGRATION_BASE_URL") ?? `${SUPABASE_URL}/functions/v1`,
        integration_api_key: Deno.env.get("INTEGRATION_API_KEY") ?? "",
        transfer_number: "",
      };
      if (baseAgentId === "agent_281c022afc5fd87515a3a7956a") {
        dynamicVars.industry = lineIndustryId;
        dynamicVars.industry_addendum = "";
      } else {
        dynamicVars.supply_team_number = "";
      }

      // live_account_agents row (per line). vapi_assistant_id column reused
      // for the shared base agent id — same value across every line that maps
      // to the same base agent, which is by design.
      const agentInsert: Record<string, unknown> = {
        customer_id: customerId,
        vapi_assistant_id: baseAgentId,
        retell_agent_id: baseAgentId,
        base_agent_id: baseAgentId,
        label: line.label,
        line_label: line.label,
        is_primary: isFirst,
        routing_type: isFirst ? "unique" : line.routing_type,
        parent_assistant_id: isFirst ? null : (primaryAgentDbId ? baseAgentId : null),
        custom_instructions: lineCustomInstructions,
        dynamic_vars: dynamicVars,
      };
      const { data: agentRow, error: agentErr } = await admin
        .from("live_account_agents").insert(agentInsert).select("id").single();
      if (agentErr || !agentRow) throw new Error(`agent_insert_failed:${agentErr?.message ?? "unknown"}`);
      created.push({ kind: "db_agent", id: agentRow.id });

      // live_account_phone_numbers row.
      const phoneInsert: Record<string, unknown> = {
        customer_id: customerId,
        agent_id: agentRow.id,
        e164: purchased.phone_number,
        provider: "telnyx",
        area_code: line.area_code,
        label: line.label,
        telnyx_phone_number_id: phoneNumberId,
      };
      const { data: phoneRow, error: phoneErr } = await admin
        .from("live_account_phone_numbers").insert(phoneInsert).select("id").single();
      if (phoneErr || !phoneRow) throw new Error(`phone_insert_failed:${phoneErr?.message ?? "unknown"}`);
      created.push({ kind: "db_phone", id: phoneRow.id });

      if (isFirst) {
        primaryAgentDbId = agentRow.id;
        primaryIndustryId = lineIndustryId;
        primaryCustomInstructions = lineCustomInstructions;
      }

      resultLines.push({
        label: line.label,
        e164: purchased.phone_number,
        retell_agent_id: baseAgentId,
        routing_type: isFirst ? "unique" : line.routing_type,
        industry_id: lineIndustryId,
        base_agent_id: baseAgentId,
      });
    }

    return new Response(JSON.stringify({
      customer_id: customerId,
      primary_agent_id: primaryAgentDbId,
      lines: resultLines,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("provision_failed", { err: msg });
    await rollback(created);
    return new Response(JSON.stringify({
      error: "provision_failed",
      detail: msg,
      needs_manual_review: true,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
