// Returns the curated list of Cartesia voices available for assignment to
// Vapi assistants. Auth-gated by the admin HMAC token (same scheme as admin-api).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SESSION_SECRET = Deno.env.get("ADMIN_SESSION_SECRET") ?? "";
const CARTESIA_API_KEY = Deno.env.get("CARTESIA_API_KEY") ?? "";

function b64urlToBytes(b64: string): Uint8Array {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacB64Url(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  let s = ""; for (const b of new Uint8Array(sig)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function verifyToken(token: string): Promise<boolean> {
  const [bodyEnc, sig] = token.split(".");
  if (!bodyEnc || !sig) return false;
  if ((await hmacB64Url(bodyEnc)) !== sig) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(bodyEnc)));
    return payload.sub === "phaos_admin" && typeof payload.exp === "number" && payload.exp >= Math.floor(Date.now() / 1000);
  } catch { return false; }
}
function json(d: unknown, status = 200) {
  return new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface CartesiaVoice {
  id: string;
  name: string;
  description?: string;
  language?: string;
  gender?: string;
  is_public?: boolean;
}

let cached: { at: number; voices: CartesiaVoice[] } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SESSION_SECRET) return json({ error: "not_configured" }, 500);
  if (!CARTESIA_API_KEY) return json({ error: "cartesia_not_configured" }, 500);

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || !(await verifyToken(token))) return json({ error: "unauthorized" }, 401);

  if (cached && Date.now() - cached.at < TTL_MS) {
    return json({ voices: cached.voices, cached: true });
  }

  try {
    const res = await fetch("https://api.cartesia.ai/voices/", {
      headers: {
        "X-API-Key": CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return json({ error: "cartesia_failed", status: res.status, detail: text.slice(0, 500) }, 502);
    }
    const data = await res.json() as Array<Record<string, unknown>>;
    const voices: CartesiaVoice[] = (Array.isArray(data) ? data : []).map((v) => ({
      id: String(v.id ?? ""),
      name: String(v.name ?? ""),
      description: typeof v.description === "string" ? v.description : undefined,
      language: typeof v.language === "string" ? v.language : undefined,
      gender: typeof v.gender === "string" ? v.gender : undefined,
      is_public: typeof v.is_public === "boolean" ? v.is_public : undefined,
    })).filter((v) => v.id && v.name);
    cached = { at: Date.now(), voices };
    return json({ voices, cached: false });
  } catch (e) {
    return json({ error: "cartesia_request_failed", message: e instanceof Error ? e.message : String(e) }, 502);
  }
});
