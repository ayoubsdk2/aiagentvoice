// Unified webhook signature verification for Stripe, Retell, and Upstash QStash.
// Each verifier reads the raw body once and returns the parsed payload, or throws.

import { decode as b64decode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

// ---- Stripe ----------------------------------------------------------------
export async function verifyStripe(req: Request, env: "sandbox" | "live"): Promise<{ event: any; rawBody: string }> {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) throw new Error("missing stripe-signature");
  const secret = env === "sandbox"
    ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  let t: string | undefined;
  const v1s: string[] = [];
  for (const part of sig.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") t = v;
    if (k === "v1") v1s.push(v);
  }
  if (!t || v1s.length === 0) throw new Error("invalid stripe sig format");
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) throw new Error("stripe sig too old");
  const expected = toHex(await hmacSha256(secret, `${t}.${body}`));
  if (!v1s.some((s) => timingSafeEqual(s, expected))) throw new Error("invalid stripe sig");
  return { event: JSON.parse(body), rawBody: body };
}

// ---- Retell ----------------------------------------------------------------
// Retell signs with HMAC-SHA256 over the raw request body and sends the hex
// digest in `x-retell-signature`.
export async function verifyRetell(req: Request): Promise<{ event: any; rawBody: string }> {
  const sig = req.headers.get("x-retell-signature") || req.headers.get("retell-signature");
  const body = await req.text();
  if (!sig) throw new Error("missing retell signature");
  const secret = getEnv("RETELL_WEBHOOK_SECRET");
  const expected = toHex(await hmacSha256(secret, body));
  if (!timingSafeEqual(sig.replace(/^sha256=/, ""), expected)) {
    throw new Error("invalid retell signature");
  }
  return { event: JSON.parse(body), rawBody: body };
}

// ---- Upstash QStash --------------------------------------------------------
// QStash signs requests with `upstash-signature` JWT (HS256). Verify against
// current and next signing keys to support rotation.
function decodeJwtPart(part: string): any {
  const norm = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  return JSON.parse(new TextDecoder().decode(b64decode(norm)));
}

async function jwtHs256Valid(token: string, secret: string): Promise<boolean> {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return false;
  const sigBytes = await hmacSha256(secret, `${h}.${p}`);
  // base64url
  const expected = btoa(String.fromCharCode(...sigBytes))
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return timingSafeEqual(expected, s);
}

export async function verifyQStash(req: Request): Promise<{ event: any; rawBody: string }> {
  const sig = req.headers.get("upstash-signature");
  const body = await req.text();
  if (!sig) throw new Error("missing upstash-signature");
  const current = getEnv("QSTASH_CURRENT_SIGNING_KEY");
  const next = Deno.env.get("QSTASH_NEXT_SIGNING_KEY") ?? "";
  const ok = (await jwtHs256Valid(sig, current)) || (next && (await jwtHs256Valid(sig, next)));
  if (!ok) throw new Error("invalid qstash signature");
  const payload = decodeJwtPart(sig.split(".")[1]);
  // Verify body hash claim if present
  if (payload.body) {
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
    const hashB64 = btoa(String.fromCharCode(...hash))
      .replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    if (hashB64 !== payload.body) throw new Error("qstash body hash mismatch");
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error("qstash token expired");
  return { event: body ? JSON.parse(body) : {}, rawBody: body };
}
