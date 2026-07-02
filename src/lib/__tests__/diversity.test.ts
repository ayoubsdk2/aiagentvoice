import { describe, it, expect } from "vitest";
import { diversityScore, uniqueValuesPerTrait } from "@/lib/content-lab/diversity";
import { TRAIT_AUTO } from "@/lib/content-lab/traits";
import type { TraitState } from "@/lib/content-lab/traits";

const make = (overrides: Partial<TraitState> = {}): TraitState => ({
  category: TRAIT_AUTO,
  voice: TRAIT_AUTO,
  audience: TRAIT_AUTO,
  intent: TRAIT_AUTO,
  angle: TRAIT_AUTO,
  length: TRAIT_AUTO,
  pov: TRAIT_AUTO,
  ...overrides,
});

describe("diversityScore", () => {
  it("returns 1 for a single combo (nothing to compare)", () => {
    expect(diversityScore([make()])).toBe(1);
  });

  it("returns ~0.14 when all 5 combos are identical (1 unique / 5 = 0.2 per trait, but identical => 1/5)", () => {
    const combos = Array.from({ length: 5 }, () => make({ voice: "Technical (Precision-focused)" }));
    const score = diversityScore(combos);
    // 1 unique value / 5 combos = 0.2 per trait, averaged across 7 traits = 0.2
    expect(score).toBeCloseTo(0.2, 2);
  });

  it("returns 1.0 when every trait differs in every combo", () => {
    const combos: TraitState[] = [
      make({ category: "A", voice: "A", audience: "A", intent: "A", angle: "A", length: "A", pov: "A" }),
      make({ category: "B", voice: "B", audience: "B", intent: "B", angle: "B", length: "B", pov: "B" }),
      make({ category: "C", voice: "C", audience: "C", intent: "C", angle: "C", length: "C", pov: "C" }),
    ];
    expect(diversityScore(combos)).toBe(1);
  });

  it("scores partially diverse runs between 0 and 1", () => {
    const combos: TraitState[] = [
      make({ voice: "Authoritative (The Expert)", category: "Faith (Theology/Values)" }),
      make({ voice: "Empathetic (Understanding the struggle)", category: "Faith (Theology/Values)" }),
      make({ voice: "Witty (Smart humor)", category: "Industry (Standard Tech/MPS)" }),
    ];
    const score = diversityScore(combos);
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(1);
  });
});

describe("uniqueValuesPerTrait", () => {
  it("counts distinct values per trait key", () => {
    const combos: TraitState[] = [
      make({ voice: "X", audience: "Y" }),
      make({ voice: "X", audience: "Z" }),
      make({ voice: "W", audience: "Y" }),
    ];
    const counts = uniqueValuesPerTrait(combos);
    expect(counts.voice).toBe(2);
    expect(counts.audience).toBe(2);
    expect(counts.category).toBe(1);
  });
});
