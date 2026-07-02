import { describe, it, expect } from "vitest";
import {
  SHARP_MFP_DATABASE,
  detectMfpModels,
  detectTerminology,
  formatSpecSummary,
} from "@/lib/sharp-mfp-specs";

describe("sharp-mfp-specs", () => {
  it("contains BP-70C and MX series entries", () => {
    expect(SHARP_MFP_DATABASE["BP-70C65"]).toBeDefined();
    expect(SHARP_MFP_DATABASE["MX-6071"]).toBeDefined();
  });

  describe("detectMfpModels", () => {
    it("matches exact model strings", () => {
      const found = detectMfpModels("Customer has a BP-70C45 unit");
      expect(found.some((s) => s.model === "BP-70C45")).toBe(true);
    });
    it("matches series fuzzily when no exact model", () => {
      const found = detectMfpModels("the MX-50 series fleet");
      expect(found.length).toBeGreaterThan(0);
    });
    it("returns empty for unrelated text", () => {
      expect(detectMfpModels("hello world")).toHaveLength(0);
    });
  });

  describe("detectTerminology", () => {
    it("identifies GSM keyword", () => {
      const t = detectTerminology("the substrate is 200 GSM");
      expect(t.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("formatSpecSummary", () => {
    it("includes core spec lines", () => {
      const lines = formatSpecSummary(SHARP_MFP_DATABASE["BP-70C65"]);
      expect(lines.join("\n")).toMatch(/MODEL/);
      expect(lines.join("\n")).toMatch(/PPM/);
      expect(lines.join("\n")).toMatch(/SUBSTRATE/);
    });
  });
});
