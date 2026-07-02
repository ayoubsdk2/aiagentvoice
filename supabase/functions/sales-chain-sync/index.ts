/**
 * Push an orchestrator_lead → Sales Chain (ECI) opportunity.
 *
 * Body: { leadId: string }
 * Looks up the lead, decrypts the customer's Sales Chain credentials,
 * POSTs to {base_url}/api/v1/opportunities, persists external_id, logs sync.
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { decryptCredentials } from "../_shared/integration-crypto.ts";
import { assertSafePublicUrl } from "../_shared/url-safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SalesChainCreds {
  base_url: string;
  api_key: string;
  pipeline_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const leadId = String(body.leadId ?? "");
  if (!leadId) {
    return new Response(JSON.stringify({ error: "leadId required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Fetch lead
  const { data: lead, error: leadErr } = await admin
    .from("orchestrator_leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr || !lead) {
    return new Response(JSON.stringify({ error: "lead not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Authorize: caller must belong to lead's tenant
  const { data: profile } = await userClient
    .from("profiles").select("customer_id").eq("id", userRes.user.id).maybeSingle();
  if (profile?.customer_id !== lead.customer_id) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch + decrypt creds
  const { data: credRow } = await admin
    .from("integration_credentials")
    .select("ciphertext, iv, auth_tag, status")
    .eq("customer_id", lead.customer_id)
    .eq("integration_id", "sales_chain")
    .maybeSingle();

  if (!credRow || credRow.status !== "active") {
    return new Response(JSON.stringify({ error: "Sales Chain not configured for this tenant" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let creds: SalesChainCreds;
  try {
    creds = await decryptCredentials<SalesChainCreds>(credRow);
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(JSON.stringify({ error: msg }), {
      status: msg.startsWith("secret_not_configured") ? 503 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // SSRF guard: refuse stored base_urls that resolve to internal/private space.
  try {
    assertSafePublicUrl(creds.base_url, "base_url");
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }



  // Map → Sales Chain opportunity
  const opportunity = {
    contact: {
      name: lead.contact_name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
    },
    pipeline_id: creds.pipeline_id,
    source: "PhaosAI Voice Agent",
    urgency: lead.urgency ?? "medium",
    custom_fields: lead.specs_json ?? {},
    notes: lead.action_taken ?? "Captured by AI voice agent",
  };

  const t0 = Date.now();
  let externalId: string | null = null;
  let outcome: "success" | "failure" = "success";
  let httpStatus = 0;
  let errorMessage: string | null = null;

  try {
    const url = new URL("/api/v1/opportunities", creds.base_url).toString();
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(opportunity),
    });
    httpStatus = r.status;
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      externalId = String(data.id ?? data.opportunity_id ?? "");
    } else {
      outcome = "failure";
      errorMessage = `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`;
    }
  } catch (e) {
    outcome = "failure";
    errorMessage = (e as Error).message;
  }

  // Update lead + log
  if (externalId) {
    await admin
      .from("orchestrator_leads")
      .update({ sales_chain_lead_id: externalId, sales_chain_synced_at: new Date().toISOString() })
      .eq("id", leadId);
  }

  await admin.from("integration_sync_log").insert({
    customer_id: lead.customer_id,
    integration_id: "sales_chain",
    direction: "outbound",
    resource_type: "opportunity",
    resource_id: leadId,
    external_id: externalId,
    outcome,
    http_status: httpStatus,
    error_message: errorMessage,
    payload_summary: { contact_name: lead.contact_name, urgency: lead.urgency },
    duration_ms: Date.now() - t0,
  });

  return new Response(
    JSON.stringify({ ok: outcome === "success", externalId, error: errorMessage }),
    { status: outcome === "success" ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
