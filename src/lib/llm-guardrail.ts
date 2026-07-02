/**
 * LLM Guardrail Wrapper
 *
 * Lightweight defense layer around any LLM call:
 *   1. Scrubs PII from the prompt before it leaves the process.
 *   2. Detects naive prompt-injection patterns and short-circuits with a
 *      safe fallback.
 *   3. Scrubs PII from the model's response before returning it.
 *   4. Re-runs the injection check on the response to catch leakage.
 *
 * Gate: `compliance_settings.prompt_injection_defense_enabled`. When that flag
 * is `false` the guardrail still scrubs output (defense-in-depth) but skips
 * pattern matching and input scrubbing.
 */

import { scrubPII } from "./pii-scrubber";
import { getComplianceSetting } from "./supabase-helpers";

export const SAFE_FALLBACK = "I'm unable to process that request.";

/** Hard cap on prompt size to prevent context-window stuffing attacks. */
export const MAX_PROMPT_CHARS = 32_000;

export const INJECTION_PATTERNS: ReadonlyArray<RegExp> = [
  /ignore\s+(?:all\s+|any\s+|the\s+)?previous\s+instructions?/i,
  /disregard\s+(?:all\s+|any\s+)?prior\s+instructions?/i,
  /forget\s+(?:all\s+|everything\s+|your\s+)?(?:previous\s+|prior\s+)?(?:instructions?|prompts?|rules?)/i,
  /(?:override|bypass|disable)\s+(?:your\s+)?(?:safety|guardrails?|filters?|restrictions?)/i,
  /(?:reveal|show|print|display|output|dump|leak)\s+(?:your\s+|the\s+)?(?:system\s+)?(?:prompt|instructions?|rules?|context)/i,
  /system\s*:\s*/i,
  /(?:^|\n)\s*assistant\s*:\s*/i,
  /"""[\s\S]*?"""/,
  /<script[\s\S]*?<\/script>/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
  /developer\s+mode/i,
  /pretend\s+(?:to\s+be|you\s+are|you're)\s+(?!a\s+helpful)/i,
  /act\s+as\s+(?:if\s+you('re| are)\s+)?(?:an?\s+)?(?:unrestricted|uncensored|jailbroken)/i,
  /\bSTART\s+OF\s+(?:NEW\s+)?(?:SYSTEM|INSTRUCTIONS?)\b/i,
];

/** Strip zero-width and bidi-control characters used to smuggle hidden text. */
function stripInvisible(s: string): string {
  // Zero-width space, ZWNJ, ZWJ, BOM, LTR/RTL marks, isolates.
  return s.replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, "");
}

/** Normalize Unicode confusables (e.g. ＩＧＮＯＲＥ) to ASCII via NFKC. */
function normalize(s: string): string {
  return stripInvisible(s.normalize("NFKC"));
}

function matchesInjection(text: string): boolean {
  const n = normalize(text);
  return INJECTION_PATTERNS.some((re) => re.test(n));
}

export type LlmCall = (prompt: string) => Promise<string>;

/**
 * Wrap an LLM call with prompt-injection + PII defenses.
 *
 * @param prompt   Raw user prompt (will be scrubbed before sending).
 * @param llmCall  Async callable that takes a (cleaned) prompt and returns
 *                 the model response text.
 * @param opts.customerId  Optional tenant id for per-tenant flag lookup.
 */
export async function guardedGenerate(
  prompt: string,
  llmCall: LlmCall,
  opts: { customerId?: string | null } = {},
): Promise<string> {
  const defenseEnabled = await getComplianceSetting(
    "prompt_injection_defense_enabled",
    opts.customerId ?? null,
  );

  // Hard length cap applies regardless of flag — defense in depth against
  // context-window stuffing.
  const truncated =
    prompt.length > MAX_PROMPT_CHARS ? prompt.slice(0, MAX_PROMPT_CHARS) : prompt;

  if (!defenseEnabled) {
    const raw = await llmCall(truncated);
    return scrubPII(normalize(raw));
  }

  const cleanPrompt = scrubPII(normalize(truncated));
  if (matchesInjection(cleanPrompt)) {
    return SAFE_FALLBACK;
  }

  const raw = await llmCall(cleanPrompt);
  const safe = scrubPII(normalize(raw));
  if (matchesInjection(safe)) {
    return SAFE_FALLBACK;
  }
  return safe;
}

