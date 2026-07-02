// QStash-triggered provisioning worker. Verifies the QStash signature,
// loads the provisioning_jobs row, runs the atomic create sequence, and
// rolls back created resources on failure. After 3 attempts the job is
// marked failed and an admin alert is fired.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyQStash } from "../_shared/verify-signatures.ts";
import { createLogger } from "../_shared/secure-logger.ts";
import { withTrace } from "../_shared/langfuse.ts";
import {
  searchNumberByAreaCode, purchaseNumber, attachToConnection,
  releaseNumber, getPhoneNumberIdByE164,
} from "../_shared/telnyx-api.ts";
import { importPhoneNumber, deletePhoneNumber } from "../_shared/retell-api.ts";
import { GENERIC_BASE_AGENT_ID, resolveBaseAgentId } from "../_shared/live-agent-defaults.ts";

const log = createLogger("provision-worker");

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Resource =
  | { kind: "telnyx_number"; id: string }
  | { kind: "retell_phone"; id: string };

async function rollback(resources: Resource[]) {
  for (let i = resources.length - 1; i >= 0; i--) {
    const r = resources[i];
    try {
      if (r.kind === "telnyx_number") await releaseNumber(r.id);
      else if (r.kind === "retell_phone") await deletePhoneNumber(r.id);
    } catch (err) {
      log.warn("rollback step failed", { resource: r, err: String(err) });
    }
  }
}

async function notifyAdminFailure(jobId: string, error: string) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-security-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ event: "provisioning_failed", job_id: jobId, error }),
    });
  } catch (err) {
    log.error("notify failed", { err: String(err) });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  let event: any;
  try {
    const v = await verifyQStash(req);
    event = v.event;
  } catch (err) {
    log.warn("qstash verify failed", { err: String(err) });
    return new Response("invalid signature", { status: 401 });
  }

  const jobId = event?.job_id;
  if (!jobId) return new Response("missing job_id", { status: 400 });

  const { data: job } = await admin.from("provisioning_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return new Response("job not found", { status: 404 });
  if (job.status === "succeeded") return new Response(JSON.stringify({ replayed: true }));

  await admin.from("provisioning_jobs").update({
    status: "running",
    attempts: (job.attempts ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);

  const payload = job.payload ?? {};
  const created: Resource[] = (job.created_resources as Resource[]) ?? [];

  try {
    await withTrace("provision.run", async (trace) => {
      const connectionId = Deno.env.get("TELNYX_CONNECTION_ID");
      if (!connectionId) throw new Error("TELNYX_CONNECTION_ID missing");

      // 1. Telnyx number
      const tSpan = trace.span("telnyx.purchase");
      const avail = await searchNumberByAreaCode(payload.area_code ?? "415");
      if (!avail) throw new Error("no_inventory");
      const purchased = await purchaseNumber(avail.phone_number);
      const phoneNumberId = await getPhoneNumberIdByE164(purchased.phone_number);
      created.push({ kind: "telnyx_number", id: phoneNumberId });
      await attachToConnection(phoneNumberId, connectionId);
      await tSpan.end({ e164: purchased.phone_number });

      // 2. Bind number to a SHARED base agent — no per-customer cloning.
      // Payload may specify an industry_id (e.g. from Stripe metadata); fall
      // back to the generic agent otherwise.
      const baseAgentId = resolveBaseAgentId(payload.industry_id);
      const inboundWebhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/retell-inbound`;

      const pSpan = trace.span("retell.import_phone");
      await importPhoneNumber({
        phone_number: purchased.phone_number,
        termination_uri: Deno.env.get("TELNYX_SIP_TERMINATION_URI") ?? "sip.telnyx.com",
        sip_trunk_auth_username: Deno.env.get("TELNYX_SIP_TRUNK_USERNAME") || undefined,
        sip_trunk_auth_password: Deno.env.get("TELNYX_SIP_TRUNK_PASSWORD") || undefined,
        nickname: payload.company_name,
        inbound_agent_id: baseAgentId,
        outbound_agent_id: baseAgentId,
        inbound_webhook_url: inboundWebhookUrl,
      });
      created.push({ kind: "retell_phone", id: purchased.phone_number });
      await pSpan.end();

      // 3. Persist
      await admin.from("retell_agents").insert({
        customer_id: job.customer_id,
        retell_agent_id: baseAgentId,
        phone_e164: purchased.phone_number,
        label: payload.company_name ?? "Primary",
        is_primary: true,
      });
      await admin.from("provisioning_jobs").update({
        status: "succeeded",
        created_resources: created,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
    }, { job_id: jobId });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("provision failed", { err: msg, attempts: (job.attempts ?? 0) + 1 });
    await rollback(created);
    const attempts = (job.attempts ?? 0) + 1;
    const finalStatus = attempts >= 3 ? "failed" : "queued";
    await admin.from("provisioning_jobs").update({
      status: finalStatus,
      created_resources: [],
      last_error: { message: msg, at: new Date().toISOString() } as any,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    if (finalStatus === "failed") await notifyAdminFailure(jobId, msg);
    // 500 lets QStash retry up to its configured retry count.
    return new Response(JSON.stringify({ error: msg }), {
      status: attempts >= 3 ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
