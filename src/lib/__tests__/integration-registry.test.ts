import { describe, it, expect } from "vitest";
import { INTEGRATION_DEFINITIONS, getIntegrationById } from "@/lib/integration-registry";

describe("integration-registry", () => {
  it("has unique ids across all definitions", () => {
    const ids = INTEGRATION_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every definition has at least one config field", () => {
    for (const def of INTEGRATION_DEFINITIONS) {
      expect(def.requiredConfigFields.length).toBeGreaterThan(0);
    }
  });

  it("every definition has manual instructions", () => {
    for (const def of INTEGRATION_DEFINITIONS) {
      expect(def.manualInstructions.length).toBeGreaterThan(0);
    }
  });

  it("getIntegrationById finds known entries", () => {
    expect(getIntegrationById("zapier")?.displayName).toBe("Zapier");
    expect(getIntegrationById("nope-nope-nope")).toBeUndefined();
  });

  it("kind is one of erp|available", () => {
    for (const def of INTEGRATION_DEFINITIONS) {
      expect(["erp", "available"]).toContain(def.kind);
    }
  });
});
