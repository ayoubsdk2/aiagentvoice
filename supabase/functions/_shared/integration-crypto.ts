/**
 * AES-256-GCM encryption helper for tenant integration credentials.
 *
 * Master key comes from `LOVABLE_INTEGRATION_KMS_KEY` (32-byte base64 string).
 * If the secret isn't configured, encryption/decryption throws — callers
 * must surface a `503 secret_not_configured` error to the client.
 *
 * Format on disk (base64 strings):
 *   ciphertext  — encrypted plaintext bytes
 *   iv          — 12-byte random nonce per record
 *   auth_tag    — 16-byte GCM auth tag (kept separate for clarity)
 */

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getMasterKey(): Promise<CryptoKey> {
  const raw =
    Deno.env.get("INTEGRATION_KMS_KEY") ??
    Deno.env.get("LOVABLE_INTEGRATION_KMS_KEY");
  if (!raw) {
    throw new Error(
      "secret_not_configured: INTEGRATION_KMS_KEY is missing. " +
        "Add it in Lovable Cloud → Secrets.",
    );
  }
  // Derive a 32-byte AES key from the secret via SHA-256 so any length /
  // encoding works (passphrase, base64, hex — all fine).
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(digest),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}


export interface EncryptedBlob {
  ciphertext: string;
  iv: string;
  auth_tag: string;
}

/**
 * Encrypt a JSON-serializable object. WebCrypto's AES-GCM appends the 16-byte
 * auth tag to the ciphertext; we split it out for storage clarity.
 */
export async function encryptCredentials(
  plaintext: Record<string, unknown>,
): Promise<EncryptedBlob> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(plaintext));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data),
  );
  // Last 16 bytes are the GCM auth tag
  const ct = sealed.slice(0, sealed.length - 16);
  const tag = sealed.slice(sealed.length - 16);
  return {
    ciphertext: b64encode(ct),
    iv: b64encode(iv),
    auth_tag: b64encode(tag),
  };
}

export async function decryptCredentials<T = Record<string, unknown>>(
  blob: EncryptedBlob,
): Promise<T> {
  const key = await getMasterKey();
  const iv = b64decode(blob.iv);
  const ct = b64decode(blob.ciphertext);
  const tag = b64decode(blob.auth_tag);
  // Reassemble for WebCrypto (ciphertext || tag)
  const sealed = new Uint8Array(ct.length + tag.length);
  sealed.set(ct, 0);
  sealed.set(tag, ct.length);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    sealed,
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/** Convenience: produce a 32-byte master key as base64 (for one-time setup). */
export function generateMasterKeyB64(): string {
  return b64encode(crypto.getRandomValues(new Uint8Array(32)));
}
