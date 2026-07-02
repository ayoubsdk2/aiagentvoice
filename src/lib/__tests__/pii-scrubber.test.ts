import { describe, it, expect } from "vitest";
import { scrubPII, containsPII } from "@/lib/pii-scrubber";

describe("pii-scrubber", () => {
  describe("phone numbers", () => {
    it("redacts US phone with parens", () => {
      const out = scrubPII("Call me at (555) 123-4567 today");
      expect(out).not.toContain("555");
      expect(out).toContain("4567");
    });
    it("redacts dotted phone", () => {
      const out = scrubPII("phone: 555.123.4567");
      expect(out).not.toContain("555.123");
      expect(out).toContain("4567");
    });
    it("redacts +1 international", () => {
      const out = scrubPII("+1-415-555-9999");
      expect(out).toContain("9999");
      expect(out).not.toContain("415");
    });
  });

  describe("emails", () => {
    it("partially redacts emails preserving domain", () => {
      const out = scrubPII("Reach me at john.doe@example.com please");
      expect(out).toContain("@example.com");
      expect(out).not.toContain("john.doe");
    });
  });

  describe("SSN", () => {
    it("fully redacts SSN", () => {
      const out = scrubPII("SSN is 123-45-6789");
      expect(out).toContain("[SSN REDACTED]");
      expect(out).not.toContain("123-45-6789");
    });
  });

  describe("credit cards", () => {
    it("redacts 16-digit card", () => {
      const out = scrubPII("My card 4111 1111 1111 1234");
      expect(out).not.toContain("4111 1111 1111 1234");
      expect(out).toContain("1234");
    });
  });

  describe("names after intro", () => {
    it("redacts first/last name after 'my name is'", () => {
      const out = scrubPII("Hello, my name is John Smith");
      expect(out).not.toContain("John Smith");
      expect(out.toLowerCase()).toContain("my name is");
    });
  });

  describe("containsPII", () => {
    it("flags text containing emails", () => {
      expect(containsPII("contact@x.io")).toBe(true);
    });
    it("returns false for clean text", () => {
      expect(containsPII("just a sentence about printers")).toBe(false);
    });
  });

  it("is a no-op for empty input", () => {
    expect(scrubPII("")).toBe("");
  });
});
