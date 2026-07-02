import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startSpan } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KEY_PATTERNS: Record<string, RegExp> = {
  openai: /^sk-/,
  resend: /^re_/,
  deepgram: /^[a-f0-9]{32,}/i,
  livekit: /^API/,
  elevenlabs: /^[a-zA-Z0-9]/,
};

async function authenticateRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const userId = await authenticateRequest(req);
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const endSpan = startSpan("manage-keys", { env: Deno.env.get("ENV") ?? "unknown" });
  try {
    const { action, service, key } = await req.json();
    if (action) (endSpan as unknown as { _attrs?: Record<string, string> })._attrs = { action };

    if (action === "validate") {
      const pattern = KEY_PATTERNS[service];
      const formatValid = pattern ? pattern.test(key) : true;

      return new Response(
        JSON.stringify({
          service,
          formatValid,
          message: formatValid
            ? `${service} key format looks valid`
            : `Warning: ${service} key format may be incorrect`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "check") {
      const services = ["OPENAI_API_KEY", "DEEPGRAM_API_KEY", "ELEVENLABS_VOICE_ID", "LIVEKIT_API_KEY", "RESEND_API_KEY"];
      const status: Record<string, boolean> = {};
      for (const s of services) {
        status[s] = !!Deno.env.get(s);
      }
      return new Response(JSON.stringify({ status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await endSpan(error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    await endSpan();
  }
});
