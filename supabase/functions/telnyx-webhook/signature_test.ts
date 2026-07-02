/**
 * Deno tests for Telnyx Ed25519 signature verification helper.
 * Generates a real Ed25519 keypair, signs a payload, and verifies it through
 * the same logic the webhook uses.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function b64encode(bytes: Uint8Array): string {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Re-implement the verify helper exactly as in supabase/functions/telnyx-webhook/index.ts
async function verify(body: string, sigB64: string, ts: string, pkB64: string): Promise<boolean> {
  try {
    const ageSec = Math.abs(Date.now() / 1000 - Number(ts));
    if (!Number.isFinite(ageSec) || ageSec > 300) return false;
    const message = new TextEncoder().encode(`${ts}|${body}`);
    const sig = b64decode(sigB64);
    const key = await crypto.subtle.importKey(
      "raw", b64decode(pkB64), { name: "Ed25519" }, false, ["verify"],
    );
    return await crypto.subtle.verify("Ed25519", key, sig, message);
  } catch { return false; }
}

Deno.test("valid Ed25519 signature passes", async () => {
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const pkRaw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const ts = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ data: { event_type: "call.initiated" } });
  const sig = new Uint8Array(
    await crypto.subtle.sign("Ed25519", kp.privateKey, new TextEncoder().encode(`${ts}|${body}`)),
  );
  const ok = await verify(body, b64encode(sig), ts, b64encode(pkRaw));
  assertEquals(ok, true);
});

Deno.test("tampered body fails", async () => {
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const pkRaw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const ts = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ data: { event_type: "call.initiated" } });
  const sig = new Uint8Array(
    await crypto.subtle.sign("Ed25519", kp.privateKey, new TextEncoder().encode(`${ts}|${body}`)),
  );
  const ok = await verify(body + "TAMPER", b64encode(sig), ts, b64encode(pkRaw));
  assertEquals(ok, false);
});

Deno.test("old timestamp rejected (replay protection)", async () => {
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const pkRaw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const ts = String(Math.floor(Date.now() / 1000) - 600); // 10 min old
  const body = "{}";
  const sig = new Uint8Array(
    await crypto.subtle.sign("Ed25519", kp.privateKey, new TextEncoder().encode(`${ts}|${body}`)),
  );
  const ok = await verify(body, b64encode(sig), ts, b64encode(pkRaw));
  assertEquals(ok, false, "should reject signatures older than 5 min");
});

Deno.test("missing/garbage signature returns false (not throws)", async () => {
  const ok = await verify("{}", "not-base64!!", String(Date.now() / 1000), "also-not-base64!!");
  assert(ok === false);
});
