// Sends a single test ping to a Make.com webhook URL without persisting any state.
// Admin-only (daniel@phaosai.com).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_EMAIL = "daniel@phaosai.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "phaos_admin",
    });
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const url = typeof body?.webhook_url === "string" ? body.webhook_url.trim() : "";
    if (!url || !/^https:\/\/hook(s)?\.([a-z0-9-]+\.)*make\.com\//i.test(url)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "URL must be a valid Make.com webhook (https://hook.make.com/...)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const settingsId = typeof body?.settings_id === "string" ? body.settings_id : null;
    const startedAt = Date.now();
    let outcome: "success" | "failed" = "failed";
    let errorMsg: string | null = null;
    let httpStatus = 0;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const nowIso = new Date().toISOString();
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "content_lab.test_ping",
          title: "Phaos AI LinkedIn Connection Test",
          image_url: "https://placekitten.com/800/450",
          linkedin_hook: "This is an automated LinkedIn test post from Phaos Content Lab.",
          blog_body: "This is a placeholder blog body for the Content Lab test ping.",
          delivered_at: nowIso,
          message: "This is a Content Lab connection test from Phaos AI.",
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      httpStatus = resp.status;
      const text = await resp.text().catch(() => "");
      if (resp.ok) {
        outcome = "success";
      } else {
        errorMsg = `HTTP ${resp.status}: ${text.slice(0, 300)}`;
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "ping failed";
    }

    // Persist last_test_* on the settings row
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    if (settingsId) {
      await admin
        .from("content_lab_settings")
        .update({
          last_test_at: new Date().toISOString(),
          last_test_outcome: outcome,
          last_test_error: errorMsg,
        })
        .eq("id", settingsId);
    }

    return new Response(
      JSON.stringify({
        ok: outcome === "success",
        outcome,
        http_status: httpStatus,
        latency_ms: Date.now() - startedAt,
        error: errorMsg,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("content-lab-test-webhook error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
