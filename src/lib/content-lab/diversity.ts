/**
 * Diversity scorer for "Surprise Me" runs. Compares N trait combos and
 * returns a 0-1 diversity index based on per-trait uniqueness ratios.
 *
 * 1.0 = every trait differs across all runs.
 * 0.0 = every trait identical across all runs.
 */

import type { TraitState, TraitKey } from "@/lib/content-lab/traits";
import { TRAIT_KEYS } from "@/lib/content-lab/traits";

export function diversityScore(combos: TraitState[]): number {
  if (combos.length < 2) return 1;
  const perTrait = TRAIT_KEYS.map((k: TraitKey) => {
    const seen = new Set(combos.map((c) => c[k]));
    return seen.size / combos.length;
  });
  return perTrait.reduce((a, b) => a + b, 0) / perTrait.length;
}

export function uniqueValuesPerTrait(combos: TraitState[]): Record<TraitKey, number> {
  const out = {} as Record<TraitKey, number>;
  for (const k of TRAIT_KEYS) {
    out[k] = new Set(combos.map((c) => c[k])).size;
  }
  return out;
}
