// Deterministic sliding-window text chunker. Approximates tokens by
// character count (~4 chars/token) so we avoid pulling a tokenizer
// dependency. Produces stable chunk hashes for upsert idempotency.

const CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = 800;
const OVERLAP_TOKENS = 120;

export interface Chunk {
  text: string;
  hash: string;
  tokens: number;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function chunkText(input: string, sourceUrl = ""): Promise<Chunk[]> {
  const clean = input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const windowChars = TARGET_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN;
  const step = windowChars - overlapChars;
  const out: Chunk[] = [];
  for (let i = 0; i < clean.length; i += step) {
    const slice = clean.slice(i, i + windowChars).trim();
    if (slice.length < 50) continue;
    const hash = await sha256Hex(sourceUrl + "\u0000" + slice);
    out.push({ text: slice, hash, tokens: Math.ceil(slice.length / CHARS_PER_TOKEN) });
  }
  return out;
}
