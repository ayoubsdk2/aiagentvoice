/**
 * E-Automate adapter (OData primary, SOAP fallback stub).
 *
 * Body:
 *   { action: 'create_service_call', payload: {...} }
 *   { action: 'fetch_meter_reads', payload: { equipmentId: string } }
 *
 * OData endpoints:
 *   POST {base_url}/odata/v1/ServiceCalls
 *   GET  {base_url}/odata/v1/MeterReadings?$filter=EquipmentId eq <id>
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { decryptCredentials } from "../_shared/integration-crypto.ts";
import { assertSafePublicUrl } from "../_shared/url-safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EAutoCreds {
  base_url: string;
  username: string;
  password: string;
  transport?: "odata" | "soap";
}

/** SOAP fallback stub — typed interface without full implementation. */
async function soapServiceCall(_creds: EAutoCreds, _payload: unknown): Promise<{ ok: boolean; id?: string; error?: string }> {
  return { ok: false, error: "SOAP transport not yet implemented; please enable OData on E-Automate server (default since v2019)." };
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
  const action = String(body.action ?? "");
  const payload = body.payload ?? {};

  const { data: profile } = await userClient
    .from("profiles").select("customer_id").eq("id", userRes.user.id).maybeSingle();
  const customerId = profile?.customer_id;
  if (!customerId) {
    return new Response(JSON.stringify({ error: "no customer bound" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: credRow } = await admin
    .from("integration_credentials")
    .select("ciphertext, iv, auth_tag, status")
    .eq("customer_id", customerId)
    .eq("integration_id", "eautomate")
    .maybeSingle();

  if (!credRow || credRow.status !== "active") {
    return new Response(JSON.stringify({ error: "E-Automate not configured" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let creds: EAutoCreds;
  try {
    creds = await decryptCredentials<EAutoCreds>(credRow);
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



  const auth = btoa(`${creds.username}:${creds.password}`);
  const t0 = Date.now();
  let result: { ok: boolean; id?: string; data?: unknown; error?: string; httpStatus?: number };

  try {
    if (action === "create_service_call") {
      if (creds.transport === "soap") {
        result = await soapServiceCall(creds, payload);
      } else {
        const url = new URL("/odata/v1/ServiceCalls", creds.base_url).toString();
        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            EquipmentId: (payload as Record<string, unknown>).equipmentId,
            ProblemDescription: (payload as Record<string, unknown>).description,
            Priority: (payload as Record<string, unknown>).priority ?? "Normal",
            CalledBy: "PhaosAI Agent",
          }),
        });
        result = r.ok
          ? { ok: true, id: String((await r.json()).Id ?? ""), httpStatus: r.status }
          : { ok: false, error: `OData ${r.status}: ${(await r.text()).slice(0, 200)}`, httpStatus: r.status };
      }
    } else if (action === "fetch_meter_reads") {
      const equipmentIdRaw = (payload as Record<string, unknown>).equipmentId;
      const equipmentId = typeof equipmentIdRaw === "string" ? equipmentIdRaw : "";
      // Strict allowlist: alphanumerics, dash, underscore, dot. Prevents OData filter injection.
      if (!equipmentId || equipmentId.length > 64 || !/^[A-Za-z0-9_.\-]+$/.test(equipmentId)) {
        return new Response(JSON.stringify({ error: "invalid equipmentId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const filter = encodeURIComponent(`EquipmentId eq '${equipmentId}'`);
      const url = new URL(
        `/odata/v1/MeterReadings?$filter=${filter}&$top=50&$orderby=ReadDate desc`,
        creds.base_url,
      ).toString();
      const r = await fetch(url, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      });
      result = r.ok
        ? { ok: true, data: await r.json(), httpStatus: r.status }
        : { ok: false, error: `OData ${r.status}`, httpStatus: r.status };
    } else {
      result = { ok: false, error: `unknown action: ${action}` };
    }
  } catch (e) {
    result = { ok: false, error: (e as Error).message };
  }

  await admin.from("integration_sync_log").insert({
    customer_id: customerId,
    integration_id: "eautomate",
    direction: action.startsWith("fetch_") ? "inbound" : "outbound",
    resource_type: action.replace("create_", "").replace("fetch_", ""),
    resource_id: null,
    external_id: result.id ?? null,
    outcome: result.ok ? "success" : "failure",
    http_status: result.httpStatus ?? 0,
    error_message: result.error ?? null,
    payload_summary: { action },
    duration_ms: Date.now() - t0,
  });

  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
