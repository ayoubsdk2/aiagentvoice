import { describe, it, expect } from "vitest";
import { evaluateRules, meetsPolicy, scorePassword } from "@/lib/password-policy";

describe("password-policy", () => {
  describe("evaluateRules", () => {
    it("flags too-short passwords", () => {
      const r = evaluateRules("aB1!");
      expect(r.minLength).toBe(false);
      expect(r.hasUppercase).toBe(true);
      expect(r.hasNumber).toBe(true);
      expect(r.hasSpecial).toBe(true);
    });
    it("recognizes a complete password", () => {
      const r = evaluateRules("Strong-Pass-1!");
      expect(r.minLength && r.hasUppercase && r.hasNumber && r.hasSpecial).toBe(true);
    });
  });

  describe("meetsPolicy", () => {
    it("rejects missing categories", () => {
      expect(meetsPolicy("alllowercase1!")).toBe(false); // no uppercase
      expect(meetsPolicy("ALLUPPERCASE1!")).toBe(false); // no lowercase rule, but no number? has 1
      expect(meetsPolicy("NoNumbersOrSpecial")).toBe(false);
      expect(meetsPolicy("Short1!")).toBe(false);
    });
    it("accepts a strong password", () => {
      expect(meetsPolicy("Correct-Horse-9!")).toBe(true);
    });
  });

  describe("scorePassword", () => {
    it("returns 0 for empty", () => {
      const s = scorePassword("");
      expect(s.score).toBe(0);
      expect(s.label).toBe("Too weak");
    });
    it("scales 1..4 with rule satisfaction", () => {
      expect(scorePassword("aaaaaaaaaa").score).toBeGreaterThanOrEqual(1);
      expect(scorePassword("Aaaaaaaaaa").score).toBeGreaterThanOrEqual(2);
      expect(scorePassword("Aaaaaaaaa1").score).toBeGreaterThanOrEqual(3);
      expect(scorePassword("Aaaaaaaa1!").score).toBe(4);
      expect(scorePassword("Aaaaaaaa1!").label).toBe("Very strong");
    });
  });
});
