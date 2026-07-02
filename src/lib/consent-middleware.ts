/**
 * Consent Enforcement Middleware
 *
 * Two helpers that enforce TCPA/GDPR-style consent rules at the edges of
 * outbound and inbound voice flows. Both rely on the existing
 * `consent_records` table and `compliance_settings.opt_out_handling` flag.
 *
 * - `checkOutboundConsent` MUST be called immediately before any outbound dial.
 * - `handleInboundOptOut` SHOULD be called on every interim transcript chunk
 *   so that "stop"/"unsubscribe"/"human" phrases trigger an immediate hangup
 *   or warm transfer.
 *
 * Both functions fail-closed when `opt_out_handling = true` and fail-open
 * (return `true` / `'continue'`) when the tenant has explicitly disabled
 * opt-out handling in compliance settings.
 */

import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Phone normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a phone number to a best-effort E.164 representation.
 * Strips formatting; assumes US (+1) when no country code is present.
 */
export function normalizeE164(phone: string): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/\D/g, "");
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

// ---------------------------------------------------------------------------
// Compliance settings helper
// ---------------------------------------------------------------------------

/**
 * Returns whether opt-out handling is enabled for the current tenant.
 * Defaults to `true` if no row is found (safer default).
 */
async function isOptOutHandlingEnabled(customerId?: string | null): Promise<boolean> {
  let query = supabase
    .from("compliance_settings")
    .select("opt_out_handling")
    .limit(1);

  if (customerId) {
    query = supabase
      .from("compliance_settings")
      .select("opt_out_handling")
      .eq("customer_id", customerId)
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    // Fail-closed on error — assume enforcement is on.
    console.warn("[consent-middleware] compliance_settings lookup failed:", error.message);
    return true;
  }
  if (!data) return true;
  return Boolean(data.opt_out_handling);
}

// ---------------------------------------------------------------------------
// 1. Outbound consent gate
// ---------------------------------------------------------------------------

/**
 * Check whether an outbound call to `phoneNumber` is permitted.
 *
 * Returns `true` only if a `consent_records` row exists with:
 *   - status = 'granted'
 *   - revoked_at IS NULL
 *   - expires_at IS NULL OR expires_at > now()
 *
 * If the tenant has `compliance_settings.opt_out_handling = false`, the gate
 * is bypassed and `true` is returned (the tenant has opted out of enforcement).
 *
 * @throws if the Supabase query fails for a reason other than "no rows".
 */
export async function checkOutboundConsent(
  phoneNumber: string,
  options?: { customerId?: string | null; channel?: "voice" | "sms" | "email" }
): Promise<boolean> {
  const enforcementOn = await isOptOutHandlingEnabled(options?.customerId);
  if (!enforcementOn) return true;

  const e164 = normalizeE164(phoneNumber);
  if (!e164 || e164.length < 6) return false;

  const channel = options?.channel ?? "voice";
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("consent_records")
    .select("id, status, revoked_at, expires_at")
    .eq("contact_phone", e164)
    .eq("channel", channel)
    .eq("status", "granted")
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(1);

  if (options?.customerId) {
    query = query.eq("customer_id", options.customerId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`consent lookup failed: ${error.message}`);
  }
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// 2. Inbound opt-out detector
// ---------------------------------------------------------------------------

const OPT_OUT_PHRASES = [
  "stop",
  "unsubscribe",
  "remove me",
  "do not call",
  "talk to a human",
  "human agent",
  "representative",
];

const HUMAN_REQUEST_PHRASES = ["talk to a human", "human agent", "representative"];

export interface InboundOptOutResult {
  action: "continue" | "hangup" | "transferToHuman";
  reason?: string;
  matchedPhrase?: string;
}

/**
 * Inspect an interim transcript chunk for opt-out / human-request phrases.
 *
 * Behavior:
 *   - If `compliance_settings.opt_out_handling = false` → `{ action: 'continue' }`.
 *   - Lower-cases transcript and matches against a fixed phrase list.
 *   - "talk to a human" / "human agent" / "representative" → `transferToHuman`.
 *   - "stop" / "unsubscribe" / "remove me" / "do not call"  → `hangup`.
 *   - No match → `{ action: 'continue' }`.
 *
 * DTMF support: callers may pre-normalize DTMF presses (e.g. "9") into the
 * transcript string before calling this helper.
 */
export async function handleInboundOptOut(input: {
  transcript: string;
  callId: string;
  customerId?: string | null;
}): Promise<InboundOptOutResult> {
  const enforcementOn = await isOptOutHandlingEnabled(input.customerId);
  if (!enforcementOn) return { action: "continue" };

  const text = (input.transcript || "").toLowerCase();
  if (!text) return { action: "continue" };

  const matched = OPT_OUT_PHRASES.find((p) => text.includes(p));
  if (!matched) return { action: "continue" };

  if (HUMAN_REQUEST_PHRASES.includes(matched)) {
    return {
      action: "transferToHuman",
      reason: `caller requested human (${matched})`,
      matchedPhrase: matched,
    };
  }

  return {
    action: "hangup",
    reason: `opt-out phrase detected (${matched})`,
    matchedPhrase: matched,
  };
}
