import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map of allowed services to their secret env var names.
// NOTE: `resend` is intentionally NOT exposed here — email sending must go
// through dedicated edge functions with explicit recipient allowlists to
// prevent authenticated users from sending arbitrary email from our domain.
const SERVICE_KEYS: Record<string, string> = {
  elevenlabs: "ELEVENLABS_VOICE_ID",
  livekit: "LIVEKIT_API_KEY",
  openai: "OPENAI_API_KEY",
  deepgram: "DEEPGRAM_API_KEY",
};

/** Validate JWT and return user ID, or null */
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authentication
  const userId = await authenticateRequest(req);
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { service, action, payload } = await req.json();

    if (!service || !SERVICE_KEYS[service]) {
      return new Response(
        JSON.stringify({ error: "Unknown or unsupported service" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get(SERVICE_KEYS[service]);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: unknown;

    switch (service) {
      case "openai":
        result = await handleOpenAI(apiKey, action, payload);
        break;
      case "elevenlabs":
        result = await handleElevenLabs(apiKey, action, payload);
        break;
      case "deepgram":
        result = await handleDeepgram(apiKey, action, payload);
        break;
      case "livekit":
        result = await handleLiveKit(apiKey, action, payload);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Service handler not implemented" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API Proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Service Handlers ────────────────────────────────────────

async function handleOpenAI(apiKey: string, action: string, payload: Record<string, unknown>) {
  const endpoints: Record<string, string> = {
    chat: "https://api.openai.com/v1/chat/completions",
    embeddings: "https://api.openai.com/v1/embeddings",
  };
  const url = endpoints[action] || endpoints.chat;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

async function handleElevenLabs(voiceId: string, action: string, payload: Record<string, unknown>) {
  return { voiceId, action, message: "ElevenLabs proxy ready. Extend with TTS calls as needed." };
}

// Resend handler removed: arbitrary email sending via this proxy is not allowed.
// Use dedicated edge functions (send-contact-email, send-transactional-email, etc.)
// with explicit recipient allowlists and template controls.


async function handleDeepgram(apiKey: string, action: string, payload: Record<string, unknown>) {
  return { apiKeyConfigured: true, action, message: "Deepgram proxy ready. Send audio data for transcription." };
}

async function handleLiveKit(apiKey: string, action: string, payload: Record<string, unknown>) {
  return { apiKeyConfigured: true, action, message: "LiveKit proxy ready. Extend with room/token generation." };
}
