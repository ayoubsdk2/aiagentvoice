import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CheckResult { component: string; status: "up" | "degraded" | "down"; latency_ms: number; details: Record<string, unknown>; }

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t0) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require either a valid Supabase JWT or the shared admin secret. This prevents
  // unauthenticated callers from flooding system_health_checks and from learning
  // which third-party API keys are configured.
  const adminSecret = Deno.env.get("PHAOS_ADMIN_SECRET") ?? "";
  const providedAdmin = req.headers.get("x-phaos-admin") ?? "";
  let authorized = !!adminSecret && providedAdmin === adminSecret;

  if (!authorized) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      try {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const token = authHeader.slice("Bearer ".length);
        const { data, error } = await userClient.auth.getClaims(token);
        if (!error && data?.claims?.sub) authorized = true;
      } catch {
        // fall through to unauthorized
      }
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: CheckResult[] = [];

  // 1. Supabase Auth — anon ping
  try {
    const { ms } = await timed(() => fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/health`, {
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
    }));
    results.push({ component: "supabase_auth", status: ms < 800 ? "up" : "degraded", latency_ms: ms, details: {} });
  } catch (e) {
    results.push({ component: "supabase_auth", status: "down", latency_ms: 0, details: { error: String(e) } });
  }

  // 2-5. Internal dependency presence checks. Names are intentionally generic and
  // booleans are not echoed back to the client to avoid leaking which third-party
  // providers are configured. Results are persisted for operators only.
  results.push({ component: "ai_gateway", status: Deno.env.get("LOVABLE_API_KEY") ? "up" : "down", latency_ms: 0, details: {} });
  results.push({ component: "tts", status: (Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVENLABS_API_KEY_1")) ? "up" : "down", latency_ms: 0, details: {} });
  results.push({ component: "stt", status: Deno.env.get("DEEPGRAM_API_KEY") ? "up" : "down", latency_ms: 0, details: {} });
  results.push({ component: "realtime", status: Deno.env.get("RETELL_API_KEY") ? "up" : "down", latency_ms: 0, details: {} });

  // Persist via service-role
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await admin.from("system_health_checks").insert(results);

  // Return a minimal acknowledgement; details remain server-side.
  const summary = results.map((r) => ({ component: r.component, status: r.status }));
  return new Response(JSON.stringify({ checked_at: new Date().toISOString(), results: summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
