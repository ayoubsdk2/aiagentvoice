import { describe, it, expect } from "vitest";
import {
  TRAIT_OPTIONS,
  TRAIT_KEYS,
  TRAIT_AUTO,
  defaultTraitState,
} from "@/lib/content-lab/traits";
import { surpriseMe, __test__ } from "@/lib/content-lab/surpriseMe";

describe("content-lab traits", () => {
  it("has 10 options for every trait key", () => {
    for (const key of TRAIT_KEYS) {
      expect(TRAIT_OPTIONS[key].length).toBe(10);
    }
  });

  it("default state is all Auto", () => {
    const s = defaultTraitState();
    for (const key of TRAIT_KEYS) {
      expect(s[key]).toBe(TRAIT_AUTO);
    }
  });
});

describe("surpriseMe guardrails", () => {
  function seeded(seed: number) {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  it("never produces forbidden combos across 500 iterations per channel", () => {
    for (const channel of ["linkedin", "facebook", "blog"] as const) {
      for (let i = 0; i < 500; i++) {
        const result = surpriseMe({ channel, rng: seeded(i + 1) });
        expect(__test__.violations(result as any).length).toBe(0);
      }
    }
  });

  it("respects channel length scoping for blog (no Punchy/Micro)", () => {
    for (let i = 0; i < 100; i++) {
      const r = surpriseMe({ channel: "blog", rng: seeded(i * 7 + 11) });
      expect(r.length.startsWith("Punchy/Micro")).toBe(false);
      expect(r.length.startsWith("Headline/Hook Only")).toBe(false);
    }
  });

  it("respects channel length scoping for linkedin (no Deep Dive)", () => {
    for (let i = 0; i < 100; i++) {
      const r = surpriseMe({ channel: "linkedin", rng: seeded(i * 13 + 3) });
      expect(r.length.startsWith("Deep Dive")).toBe(false);
    }
  });

  it("never returns Auto", () => {
    const r = surpriseMe({ channel: "blog" });
    for (const key of TRAIT_KEYS) {
      expect(r[key]).not.toBe(TRAIT_AUTO);
    }
  });

  it("rules JSON references only valid trait labels", () => {
    const rules = __test__.RULES;
    const allValues: Record<string, Set<string>> = {
      voice: new Set(TRAIT_OPTIONS.voice),
      audience: new Set(TRAIT_OPTIONS.audience),
      intent: new Set(TRAIT_OPTIONS.intent),
      angle: new Set(TRAIT_OPTIONS.angle),
      length: new Set(TRAIT_OPTIONS.length),
      pov: new Set(TRAIT_OPTIONS.pov),
    };
    const validCategories = new Set(TRAIT_OPTIONS.category);
    for (const cat of Object.keys(rules.categoryRules)) {
      expect(validCategories.has(cat)).toBe(true);
      const rule = rules.categoryRules[cat];
      for (const bag of [rule.prefer, rule.avoid]) {
        if (!bag) continue;
        for (const [field, values] of Object.entries(bag)) {
          const pool = allValues[field];
          expect(pool, `unknown field: ${field}`).toBeDefined();
          for (const v of values as string[]) {
            expect(pool!.has(v), `${cat} → ${field}: "${v}" not in trait list`).toBe(true);
          }
        }
      }
    }
  });

  it("biases Security/Policy toward Data-Driven or Problem/Solution angle", () => {
    function seeded(seed: number) {
      let s = seed;
      return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    }
    let preferredAngleHits = 0;
    let secCategoryHits = 0;
    for (let i = 0; i < 800; i++) {
      const r = surpriseMe({ channel: "blog", rng: seeded(i + 1) });
      if (r.category.startsWith("Security/Policy")) {
        secCategoryHits++;
        if (
          r.angle === "Data-Driven Insight" ||
          r.angle === "Problem/Solution" ||
          r.angle.startsWith("The \"Hard Truth\"")
        ) {
          preferredAngleHits++;
        }
      }
    }
    if (secCategoryHits >= 20) {
      // With 5x weighting, preferred angles should dominate well over chance (~30%).
      expect(preferredAngleHits / secCategoryHits).toBeGreaterThan(0.55);
    }
  });
});
