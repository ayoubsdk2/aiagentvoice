/**
 * Encrypt + persist + test integration credentials in one round trip.
 *
 * Body: { integrationId: string, credentials: Record<string,string> }
 * Auth: requires JWT — caller must be customer_admin of their tenant
 *       (RLS enforces this on the underlying table).
 *
 * Returns: { status: 'active' | 'failed', message?: string }
 */
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { encryptCredentials } from "../_shared/integration-crypto.ts";
import { runIntegrationTest, REQUIRED_FIELDS } from "../_shared/integration-tests.ts";
import { assertSafePublicUrl } from "../_shared/url-safety.ts";

const URL_FIELDS = new Set(["base_url", "endpoint_url", "server_url", "instance_url", "webhook_url"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth client (RLS-bound) to identify caller + read tenant
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const integrationId = String(body.integrationId ?? "").trim();
    const credentials = body.credentials;
    if (!integrationId || !credentials || typeof credentials !== "object") {
      return new Response(JSON.stringify({ error: "integrationId + credentials required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up tenant for this user — only trust profile.customer_id (admin-assigned).
    // Never fall back to last_live_customer_id: that field is user-writable and
    // would allow cross-tenant credential writes via service-role bypass.
    const { data: profile } = await userClient
      .from("profiles")
      .select("customer_id")
      .eq("id", userRes.user.id)
      .maybeSingle();
    const customerId = profile?.customer_id;
    if (!customerId) {
      return new Response(JSON.stringify({ error: "no customer bound to user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is a customer_admin for their tenant before bypassing RLS.
    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "customer_admin",
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required-field shape early so we never store empty creds
    const required = REQUIRED_FIELDS[integrationId] ?? [];
    const missing = required.filter((f) => !credentials[f] || String(credentials[f]).trim() === "");
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          status: "failed",
          message: `Missing required fields: ${missing.join(", ")}`,
          missingFields: missing,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // SSRF guard: any URL-shaped field must be a safe, public http(s) URL.
    for (const [k, v] of Object.entries(credentials as Record<string, unknown>)) {
      if (!URL_FIELDS.has(k)) continue;
      const val = typeof v === "string" ? v.trim() : "";
      if (!val) continue;
      try {
        assertSafePublicUrl(val, k);
      } catch (e) {
        return new Response(
          JSON.stringify({ status: "failed", message: (e as Error).message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }



    // 1. Encrypt
    let blob;
    try {
      blob = await encryptCredentials(credentials);
    } catch (e) {
      const msg = (e as Error).message;
      const status = msg.startsWith("secret_not_configured") ? 503 : 500;
      return new Response(JSON.stringify({ status: "failed", message: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Run live test
    const test = await runIntegrationTest(integrationId, credentials as Record<string, string>);

    // 3. Upsert (service role bypasses RLS — we already verified caller is admin via getUser)
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
    const fieldHints = Object.fromEntries(
      Object.keys(credentials).map((k) => [k, true]),
    );
    const { error: upsertErr } = await adminClient
      .from("integration_credentials")
      .upsert(
        {
          customer_id: customerId,
          integration_id: integrationId,
          ciphertext: blob.ciphertext,
          iv: blob.iv,
          auth_tag: blob.auth_tag,
          field_hints: fieldHints,
          status: test.ok ? "active" : "failed",
          last_tested_at: new Date().toISOString(),
          last_test_outcome: test.ok ? "ok" : "failed",
          last_test_error: test.ok ? null : (test.message ?? "unknown"),
          created_by: userRes.user.id,
        },
        { onConflict: "customer_id,integration_id" },
      );

    if (upsertErr) {
      return new Response(JSON.stringify({ status: "failed", message: upsertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        status: test.ok ? "active" : "failed",
        message: test.message,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "failed", message: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
