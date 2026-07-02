// Public lister for Retell voices. Keeps RETELL_API_KEY server-side and
// returns the upstream array verbatim. Short in-memory cache to avoid
// hammering Retell on repeated sandbox loads.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface RetellVoice {
  voice_id: string;
  voice_name: string;
  provider?: string;
  accent?: string;
  gender?: string;
  preview_audio_url?: string;
  [k: string]: unknown;
}

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; data: RetellVoice[] } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const key = Deno.env.get("RETELL_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "missing_retell_api_key" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (cache && Date.now() - cache.at < TTL_MS) {
    return new Response(JSON.stringify({ voices: cache.data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  }

  try {
    const res = await fetch("https://api.retellai.com/list-voices", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const body = await res.text();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "retell_error", status: res.status, detail: body.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const parsed = JSON.parse(body) as RetellVoice[] | { voices?: RetellVoice[] };
    const voices = Array.isArray(parsed) ? parsed : (parsed.voices ?? []);
    cache = { at: Date.now(), data: voices };
    return new Response(JSON.stringify({ voices }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "fetch_failed", detail: String(err) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
