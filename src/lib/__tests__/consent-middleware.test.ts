import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase mock with chainable query builder ---------------------------

type Scenario = {
  consentRow?: { id: string; status: string; revoked_at: string | null; expires_at: string | null } | null;
  consentError?: { message: string } | null;
  optOutHandling?: boolean;
};

let scenario: Scenario = {};

function makeChain(table: string) {
  const chain: Record<string, unknown> = {};
  const passthrough = ["select", "eq", "is", "or", "limit"] as const;
  for (const m of passthrough) (chain as Record<string, () => unknown>)[m] = () => chain;

  (chain as Record<string, () => Promise<unknown>>).maybeSingle = async () => {
    if (table === "compliance_settings") {
      return { data: { opt_out_handling: scenario.optOutHandling ?? true }, error: null };
    }
    if (table === "consent_records") {
      return { data: scenario.consentRow ?? null, error: scenario.consentError ?? null };
    }
    return { data: null, error: null };
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => makeChain(table) },
}));

import {
  checkOutboundConsent,
  handleInboundOptOut,
  normalizeE164,
} from "@/lib/consent-middleware";

beforeEach(() => {
  scenario = { optOutHandling: true };
});

// ---- normalizeE164 --------------------------------------------------------

describe("normalizeE164", () => {
  it("adds +1 to a 10-digit US number", () => {
    expect(normalizeE164("(415) 555-9999")).toBe("+14155559999");
  });
  it("preserves an already-prefixed E.164 number", () => {
    expect(normalizeE164("+442071838750")).toBe("+442071838750");
  });
  it("returns empty string for empty input", () => {
    expect(normalizeE164("")).toBe("");
  });
});

// ---- checkOutboundConsent -------------------------------------------------

describe("checkOutboundConsent", () => {
  it("returns true when valid, non-revoked consent exists", async () => {
    scenario.consentRow = { id: "c1", status: "granted", revoked_at: null, expires_at: null };
    expect(await checkOutboundConsent("+14155559999")).toBe(true);
  });

  it("returns false when no consent row is found", async () => {
    scenario.consentRow = null;
    expect(await checkOutboundConsent("+14155559999")).toBe(false);
  });

  it("returns false for an invalid/short phone number", async () => {
    scenario.consentRow = { id: "c1", status: "granted", revoked_at: null, expires_at: null };
    expect(await checkOutboundConsent("12")).toBe(false);
  });

  it("bypasses the gate (returns true) when opt_out_handling is disabled", async () => {
    scenario = { optOutHandling: false, consentRow: null };
    expect(await checkOutboundConsent("+14155559999")).toBe(true);
  });

  it("throws when the consent lookup errors", async () => {
    scenario = { optOutHandling: true, consentError: { message: "db unreachable" } };
    await expect(checkOutboundConsent("+14155559999")).rejects.toThrow(/consent lookup failed/);
  });
});

// ---- handleInboundOptOut --------------------------------------------------

describe("handleInboundOptOut", () => {
  const base = { callId: "call_abc", customerId: "cust_1" };

  it("hangs up on 'stop'", async () => {
    const r = await handleInboundOptOut({ ...base, transcript: "Please STOP calling me" });
    expect(r.action).toBe("hangup");
    expect(r.matchedPhrase).toBe("stop");
  });

  it("hangs up on 'unsubscribe'", async () => {
    const r = await handleInboundOptOut({ ...base, transcript: "unsubscribe me from this list" });
    expect(r.action).toBe("hangup");
  });

  it("transfers to human on 'talk to a human'", async () => {
    const r = await handleInboundOptOut({ ...base, transcript: "I want to talk to a human now" });
    expect(r.action).toBe("transferToHuman");
  });

  it("transfers to human on 'representative'", async () => {
    const r = await handleInboundOptOut({ ...base, transcript: "Get me a representative" });
    expect(r.action).toBe("transferToHuman");
  });

  it("continues on benign transcript", async () => {
    const r = await handleInboundOptOut({ ...base, transcript: "What's the weather today?" });
    expect(r.action).toBe("continue");
  });

  it("continues when opt_out_handling is disabled, even with 'stop'", async () => {
    scenario = { optOutHandling: false };
    const r = await handleInboundOptOut({ ...base, transcript: "stop" });
    expect(r.action).toBe("continue");
  });

  it("continues on empty transcript", async () => {
    const r = await handleInboundOptOut({ ...base, transcript: "" });
    expect(r.action).toBe("continue");
  });
});
