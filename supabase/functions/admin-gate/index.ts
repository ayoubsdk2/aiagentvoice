// Admin credential gate. Validates username/password against secrets and
// issues a short-lived HMAC-signed session token. Independent of Supabase auth.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_USERNAME = Deno.env.get("ADMIN_USERNAME") ?? "";
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "";
const SESSION_SECRET = Deno.env.get("ADMIN_SESSION_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

const supabase = SUPABASE_URL && SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE) : null;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEYLEN = 32;

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2Hash(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    PBKDF2_KEYLEN * 8,
  );
  return new Uint8Array(bits);
}

async function encodePbkdf2(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Hash(password, salt);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(hash)}`;
}

async function verifyEncoded(password: string, encoded: string): Promise<boolean> {
  if (encoded.startsWith("pbkdf2$")) {
    const [, iterStr, saltB64, hashB64] = encoded.split("$");
    const iterations = parseInt(iterStr, 10);
    if (!iterations || !saltB64 || !hashB64) return false;
    const salt = b64ToBytes(saltB64);
    const expected = b64ToBytes(hashB64);
    const actual = await pbkdf2Hash(password, salt, iterations);
    if (actual.length !== expected.length) return false;
    let r = 0;
    for (let i = 0; i < actual.length; i++) r |= actual[i] ^ expected[i];
    return r === 0;
  }
  // Legacy unsalted SHA-256 entries (deprecated). Still accepted so existing
  // overrides keep working until the next password reset upgrades them.
  const candHash = await sha256Hex(password);
  return timingSafeEqual(candHash, encoded);
}

async function getOverrideHash(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from("admin_password_override")
      .select("password_hash")
      .eq("id", "singleton")
      .maybeSingle();
    return data?.password_hash ?? null;
  } catch {
    return null;
  }
}

async function setOverrideHash(hash: string): Promise<void> {
  if (!supabase) throw new Error("storage_unavailable");
  const { error } = await supabase
    .from("admin_password_override")
    .upsert({ id: "singleton", password_hash: hash, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

async function verifyAdminPassword(candidate: string): Promise<boolean> {
  const override = await getOverrideHash();
  if (override) return verifyEncoded(candidate, override);
  return timingSafeEqual(candidate, ADMIN_PASSWORD);
}


function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64url(sig);
}

async function issueToken(): Promise<string> {
  const payload = {
    sub: "phaos_admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

async function verifyToken(token: string): Promise<boolean> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = await hmac(body);
  if (expected !== sig) return false;
  try {
    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.sub !== "phaos_admin") return false;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "login";

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !SESSION_SECRET) {
    return new Response(JSON.stringify({ error: "admin_gate_not_configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "verify") {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const ok = token ? await verifyToken(token) : false;
    return new Response(JSON.stringify({ ok }), {
      status: ok ? 200 : 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "login" && req.method === "POST") {
    let body: { username?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const u = (body.username ?? "").trim();
    const p = body.password ?? "";
    const okU = timingSafeEqual(u.toLowerCase(), ADMIN_USERNAME.toLowerCase());
    const okP = await verifyAdminPassword(p);
    if (!(okU && okP)) {
      return new Response(JSON.stringify({ error: "invalid_credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = await issueToken();
    return new Response(JSON.stringify({ token, expires_in: SESSION_TTL_SECONDS }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "reset-password" && req.method === "POST") {
    let body: { current_password?: string; new_password?: string };
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cur = body.current_password ?? "";
    const next = body.new_password ?? "";
    if (next.length < 10) {
      return new Response(JSON.stringify({ error: "new_password_too_short" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ok = await verifyAdminPassword(cur);
    if (!ok) {
      return new Response(JSON.stringify({ error: "invalid_current_password" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      const hash = await encodePbkdf2(next);
      await setOverrideHash(hash);
    } catch (e) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "save_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
