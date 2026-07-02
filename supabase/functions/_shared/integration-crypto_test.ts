/**
 * Deno tests for AES-256-GCM credential encryption.
 * Run:  deno test --allow-env supabase/functions/_shared/integration-crypto_test.ts
 */
import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Set a deterministic master key BEFORE importing the module
const TEST_KEY = btoa(
  String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 1)),
);
Deno.env.set("LOVABLE_INTEGRATION_KMS_KEY", TEST_KEY);

const { encryptCredentials, decryptCredentials, generateMasterKeyB64 } = await import("./integration-crypto.ts");

Deno.test("encrypt + decrypt roundtrip", async () => {
  const plain = { api_key: "sk_live_abc123", base_url: "https://api.example.com" };
  const blob = await encryptCredentials(plain);
  assert(blob.ciphertext.length > 0);
  assert(blob.iv.length > 0);
  assert(blob.auth_tag.length > 0);
  const back = await decryptCredentials<typeof plain>(blob);
  assertEquals(back, plain);
});

Deno.test("two encryptions of same plaintext produce different IVs", async () => {
  const plain = { x: "y" };
  const a = await encryptCredentials(plain);
  const b = await encryptCredentials(plain);
  assert(a.iv !== b.iv, "IV should be random per call");
  assert(a.ciphertext !== b.ciphertext, "Ciphertext should differ");
});

Deno.test("tampered ciphertext fails auth tag verification", async () => {
  const plain = { secret: "value" };
  const blob = await encryptCredentials(plain);
  // Flip a byte in the ciphertext
  const flipped = { ...blob, ciphertext: blob.ciphertext.replace(/^./, blob.ciphertext[0] === "A" ? "B" : "A") };
  await assertRejects(() => decryptCredentials(flipped));
});

Deno.test("missing master key throws secret_not_configured", async () => {
  Deno.env.delete("LOVABLE_INTEGRATION_KMS_KEY");
  await assertRejects(
    () => encryptCredentials({ a: "b" }),
    Error,
    "secret_not_configured",
  );
  Deno.env.set("LOVABLE_INTEGRATION_KMS_KEY", TEST_KEY);
});

Deno.test("generateMasterKeyB64 produces 32-byte key", () => {
  const k = generateMasterKeyB64();
  const bytes = atob(k);
  assertEquals(bytes.length, 32);
});
