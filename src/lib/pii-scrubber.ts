/**
 * PII Scrubber — Redacts personally identifiable information for display purposes.
 * Raw data is preserved in the database; this only sanitizes UI output.
 *
 * Redacts:
 * - Phone numbers (US/international formats)
 * - Email addresses
 * - SSN patterns
 * - Credit card patterns
 * - Names preceded by common identifiers ("my name is", "this is", etc.)
 */

const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SSN_REGEX = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;
const CREDIT_CARD_REGEX = /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g;
const NAME_INTRO_REGEX = /(?:my name is|this is|i'm|i am|name's|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi;

/** Characters used for redaction */
const REDACT_CHAR = "•";

function redactMatch(match: string, label: string): string {
  if (match.length <= 4) return `[${label}]`;
  const visible = match.slice(-4);
  return `${REDACT_CHAR.repeat(Math.min(match.length - 4, 8))}${visible}`;
}

/**
 * Scrub PII from text for display. Returns redacted string.
 * Does NOT modify the original — pure function.
 */
export function scrubPII(text: string): string {
  if (!text) return text;

  let result = text;

  // Redact credit cards first (longer patterns before shorter)
  result = result.replace(CREDIT_CARD_REGEX, (m) => redactMatch(m, "CC"));

  // Redact SSNs
  result = result.replace(SSN_REGEX, "[SSN REDACTED]");

  // Redact phone numbers
  result = result.replace(PHONE_REGEX, (m) => {
    const digits = m.replace(/\D/g, "");
    const last4 = digits.slice(-4);
    return `${REDACT_CHAR.repeat(6)}${last4}`;
  });

  // Redact email addresses
  result = result.replace(EMAIL_REGEX, (m) => {
    const [local, domain] = m.split("@");
    const redactedLocal = local.length > 2
      ? local[0] + REDACT_CHAR.repeat(Math.min(local.length - 2, 6)) + local[local.length - 1]
      : REDACT_CHAR.repeat(2);
    return `${redactedLocal}@${domain}`;
  });

  // Redact names after identifiers
  result = result.replace(NAME_INTRO_REGEX, (fullMatch, name: string) => {
    const prefix = fullMatch.slice(0, fullMatch.length - name.length);
    const parts = name.split(" ");
    const redacted = parts.map((p: string) =>
      p.length > 1 ? p[0] + REDACT_CHAR.repeat(Math.min(p.length - 1, 5)) : p
    ).join(" ");
    return `${prefix}${redacted}`;
  });

  return result;
}

/**
 * Check if text likely contains PII.
 */
export function containsPII(text: string): boolean {
  return (
    PHONE_REGEX.test(text) ||
    EMAIL_REGEX.test(text) ||
    SSN_REGEX.test(text) ||
    CREDIT_CARD_REGEX.test(text)
  );
}
