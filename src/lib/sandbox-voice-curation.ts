// Curated rules for the sandbox Voice dropdown.
// Rules are keyed by the upstream `voice_name` and reference the
// ORIGINAL numbering the user sees (alphabetical sort + API order
// within each duplicate group, starting at 1).
//
// • `remove`        — original indices to drop entirely
// • `noTest`        — original indices to keep but hide the ▶ TEST button
// • `onlyWithTest`  — strict allowlist: ONLY these indices survive, all
//                     with the ▶ TEST button enabled
//
// Voices not mentioned here fall through to: keep + TEST enabled.

export interface FamilyRule {
  remove?: number[];
  noTest?: number[];
  onlyWithTest?: number[];
}

// Explicit per-family curation from the user.
export const FAMILY_RULES: Record<string, FamilyRule> = {
  Adrian: { remove: [3, 4, 5], noTest: [1, 2] },
  Susan: { remove: [3] },
  Alejandro: { remove: [2, 3, 4, 5] },
  Andrea: { remove: [2, 3, 4, 5], noTest: [1] },
  Bing: { remove: [2] },
  Brynne: { remove: [1, 3], noTest: [4, 5, 6] },
  Della: { remove: [3, 4, 5, 6] },
  Gabby: { remove: [2, 3, 4, 5] },
  Grace: { remove: [3, 4, 5, 6] },
  Hailey: { remove: [1, 4], noTest: [3] },
  "Hailey - French": { remove: [1] },
  "Hailey - Spanish, Latin America": { remove: [1] },
  "Hailey, Brazilian Portugese": { remove: [1] },
  James: { remove: [1] },
  Jason: { remove: [4] },
  Kate: { remove: [2, 3, 4, 5, 6, 7] },
  Kathrine: { remove: [3] },
  Leland: { remove: [2, 3, 4, 5, 6] },
  Lucas: { remove: [1, 3] },
  Maren: { remove: [1, 3, 4, 5, 6] },
  Xuri: { remove: [3] },
  Victoria: { remove: [1] },
  "Victoria - Refined Coordinator": { remove: [1] },
  Test: { remove: [1] },
  Paul: { remove: [2] },
  Paola: { remove: [2] },
  Nyla: { remove: [2] },
  Nico: { remove: [1, 3, 4, 5], noTest: [2] },
  Myra: { remove: [1, 2] },
  Marissa: { remove: [2, 3, 4, 5, 6, 7] },

  // Strict allowlists — only these indices survive (with TEST).
  Andrew: { onlyWithTest: [3] },
  Chloe: { onlyWithTest: [5, 7] },
  Cimo: { onlyWithTest: [5, 6] },
  Claudia: { onlyWithTest: [3, 4] },
  Merritt: { onlyWithTest: [1, 4] },
  Rita: { onlyWithTest: [3] },
  Sloane: { onlyWithTest: [6] },
  Tamsin: { onlyWithTest: [3] },
  Willa: { onlyWithTest: [4] },
};

// Names the user wants kept but with TEST hidden. `'all'` means every
// surviving entry under that name; an array limits to specific original
// indices.
export const NO_TEST_NAMES: Record<string, number[] | "all"> = {
  Adam: "all",
  Aiden: "all",
  Amy: "all",
  Andre: "all",
  Anthony: [3],
  Ash: "all",
  Ashley: [1],
  Ballad: "all",
  Bellona: "all",
  Billy: [2],
  Brooke: "all",
  Camille: "all",
  Carola: "all",
  Cathy: "all",
  Cedar: "all",
  Cleo: [1],
  Coral: "all",
  Yumi: "all",
  Crystal: "all",
  Dallas: "all",
  Daniel: "all",
  "Eldric Sage": "all",
  Ellen: "all",
  Emily: [1, 2],
  Emma: "all",
  Ethan: [1, 2],
  Eve: "all",
  George: "all",
  Gilfoy: [2],
  Holly: "all",
  Jack: "all",
  Jacqueline: "all",
  Janelle: "all",
  Joan: "all",
  John: [2],
  Josh: "all",
  Julia: [3],
  Katerina: "all",
  Kathy: "all",
  Katie: "all",
  Kevin: "all",
  Lily: [2, 3],
  Ryan: [1],
  Pluto: "all",
  Pierre: "all",
  Nina: [1],
  Nia: [1],
  Nathan: "all",
  Nancy: "all",
  Monika: "all",
  Miguel: "all",
  Michael: "all",
  Mia: [2],
  May: "all",
  Max: [1, 4],
  Manuel: "all",
  Luna: "all",
  Lina: "all",
  Verse: "all",
  Suzanne: "all",
  Sophie: "all",
  Savannah: "all",
  Sarah: "all",
  Santiago: "all",
  Sage: "all",
};

export type Decision = { keep: false } | { keep: true; testable: boolean };

/**
 * Decide whether a given voice (by base name + 1-based original index in
 * its name-group) should be kept, and whether the ▶ TEST button should be
 * exposed for it. Default for unmentioned voices: keep + TEST enabled.
 */
export function decide(name: string, originalIndex: number): Decision {
  const fam = FAMILY_RULES[name];
  if (fam) {
    if (fam.onlyWithTest) {
      return fam.onlyWithTest.includes(originalIndex)
        ? { keep: true, testable: true }
        : { keep: false };
    }
    if (fam.remove?.includes(originalIndex)) return { keep: false };
    if (fam.noTest?.includes(originalIndex)) return { keep: true, testable: false };
    // Mentioned family but this index has no rule → default keep + TEST.
    return { keep: true, testable: true };
  }
  const nt = NO_TEST_NAMES[name];
  if (nt !== undefined) {
    const hide = nt === "all" || nt.includes(originalIndex);
    return { keep: true, testable: !hide };
  }
  return { keep: true, testable: true };
}

// ─── Adjective generator ─────────────────────────────────────
// Two descriptive adjectives derived from gender/accent/age metadata.
// Deterministic so the same voice always renders the same pair.
export function describeVoice(meta: {
  gender?: string;
  accent?: string;
  age?: string;
}): [string, string] {
  const accent = (meta.accent || "").toLowerCase();
  const gender = (meta.gender || "").toLowerCase();
  const age = (meta.age || "").toLowerCase();

  const pool: string[] = [];
  if (accent.includes("british")) pool.push("refined", "crisp");
  else if (accent.includes("american")) pool.push("warm", "approachable");
  else if (accent.includes("mexican")) pool.push("expressive", "lively");
  else if (accent.includes("spanish")) pool.push("expressive", "rhythmic");
  else if (accent.includes("french")) pool.push("elegant", "melodic");
  else if (accent.includes("german")) pool.push("precise", "measured");
  else if (accent.includes("indian")) pool.push("articulate", "poised");
  else if (accent.includes("australian")) pool.push("relaxed", "confident");
  else if (accent.includes("brazilian") || accent.includes("portug")) pool.push("vibrant", "buoyant");
  else if (accent.includes("english")) pool.push("clear", "balanced");

  if (age.includes("young")) pool.push("youthful", "bright");
  else if (age.includes("middle")) pool.push("mature", "composed");
  else if (age.includes("old")) pool.push("seasoned", "grounded");

  if (gender === "male") pool.push("assured", "steady");
  else if (gender === "female") pool.push("inviting", "smooth");

  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of pool) {
    if (!seen.has(w)) { seen.add(w); out.push(w); }
    if (out.length === 2) break;
  }
  while (out.length < 2) out.push("versatile");
  return [out[0], out[1]];
}
