/**
 * Smart-random "Surprise Me!" trait roller.
 *
 * Strategy:
 *   1. Pick a Category first (channel-aware bias).
 *   2. For each remaining trait, build a weighted pool from
 *      `surprise-rules.json` → categoryRules[category].prefer (×5 weight),
 *      filter out anything in `.avoid`, and apply channel length preference.
 *   3. Validate the combo against hard guardrails + JSON `comboBans`.
 *      Re-roll up to maxRerolls times; fall back to a vetted house combo.
 *
 * The rules JSON is the only file editors need to touch to retune behavior.
 */

import {
  TRAIT_OPTIONS,
  type TraitKey,
  type TraitState,
} from "./traits";
import rulesData from "./surprise-rules.json";

export type Channel = "linkedin" | "facebook" | "blog";

type RNG = () => number;

interface CategoryRule {
  prefer?: Partial<Record<Exclude<TraitKey, "category">, string[]>>;
  avoid?: Partial<Record<Exclude<TraitKey, "category">, string[]>>;
}
interface ChannelRule {
  preferLengths?: string[];
}
interface ComboBan {
  ifAngle?: string;
  ifIntent?: string;
  thenNotLength?: string;
  thenNotPov?: string;
}
interface RulesShape {
  categoryRules: Record<string, CategoryRule>;
  channelRules: Record<Channel, ChannelRule>;
  comboBans: ComboBan[];
}

const RULES = rulesData as unknown as RulesShape;
const PREFER_WEIGHT = 5;

function pick<T>(arr: readonly T[], rng: RNG): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Channel-aware allowed Length pool (hard filter, before weighting). */
function allowedLengths(channel: Channel): readonly string[] {
  const all = TRAIT_OPTIONS.length;
  if (channel === "linkedin") {
    return all.filter(
      (l) =>
        l.startsWith("Punchy/Micro") ||
        l.startsWith("Headline/Hook Only") ||
        l.startsWith("Short Narrative") ||
        l.startsWith("The \"TL;DR\""),
    );
  }
  if (channel === "facebook") {
    return all.filter((l) => !l.startsWith("Deep Dive"));
  }
  return all.filter(
    (l) =>
      l.startsWith("Standard Post") ||
      l.startsWith("Bullet-Point") ||
      l.startsWith("Deep Dive") ||
      l.startsWith("Two-Part") ||
      l.startsWith("Actionable Checklist"),
  );
}

/** Build a weighted pool: base options minus 'avoid', preferred entries repeated. */
function weightedPool(
  base: readonly string[],
  prefer: string[] | undefined,
  avoid: string[] | undefined,
): string[] {
  const avoidSet = new Set(avoid ?? []);
  const filtered = base.filter((o) => !avoidSet.has(o));
  if (filtered.length === 0) return [...base]; // safety: never empty
  const preferSet = (prefer ?? []).filter((p) => filtered.includes(p));
  const pool = [...filtered];
  for (const p of preferSet) {
    for (let i = 0; i < PREFER_WEIGHT - 1; i++) pool.push(p);
  }
  return pool;
}

interface Combo {
  category: string;
  voice: string;
  audience: string;
  intent: string;
  angle: string;
  length: string;
  pov: string;
}

/** Hard guardrails that survive re-rolling, applied AFTER JSON rules. */
function violations(c: Combo): string[] {
  const v: string[] = [];

  // JSON-driven combo bans.
  for (const ban of RULES.comboBans) {
    if (ban.ifAngle && c.angle === ban.ifAngle) {
      if (ban.thenNotLength && c.length === ban.thenNotLength) v.push("ban_angle_length");
      if (ban.thenNotPov && c.pov === ban.thenNotPov) v.push("ban_angle_pov");
    }
    if (ban.ifIntent && c.intent === ban.ifIntent) {
      if (ban.thenNotPov && c.pov === ban.thenNotPov) v.push("ban_intent_pov");
      if (ban.thenNotLength && c.length === ban.thenNotLength) v.push("ban_intent_length");
    }
  }

  // Brand-specific guardrails kept in code (high-stakes, not data-driven).
  if (c.voice.startsWith("Witty") && c.audience.startsWith("C-Suite")) {
    v.push("witty_csuite");
  }
  if (
    c.category.startsWith("Faith") &&
    c.audience.startsWith("Skeptics") &&
    !(
      c.voice.startsWith("Empathetic") ||
      c.voice.startsWith("Winsome") ||
      c.voice.startsWith("Grounded")
    )
  ) {
    v.push("faith_skeptics_needs_warm_voice");
  }

  return v;
}

const HOUSE_COMBO_BY_CHANNEL: Record<Channel, Combo> = {
  linkedin: {
    category: "Industry (Standard Tech/MPS)",
    voice: "Grounded (Practical/Common sense)",
    audience: "IT Managers (Infrastructure focus)",
    intent: "Educate & Inform (Value-add)",
    angle: "Problem/Solution",
    length: "Punchy/Micro (1–2 sentences)",
    pov: "2nd Person (You) – Direct advice to reader",
  },
  facebook: {
    category: "Community (Social Proof/Events)",
    voice: "Winsome (Warm & Appealing)",
    audience: "Small Business Owners (Efficiency focus)",
    intent: "Start a Conversation (Engagement)",
    angle: "Behind the Scenes (Transparency)",
    length: "Standard Post (2–3 paragraphs)",
    pov: "1st Person Plural (We) – Company/Team view",
  },
  blog: {
    category: "Leadership (Management/Culture)",
    voice: "Authoritative (The Expert)",
    audience: "IT Managers (Infrastructure focus)",
    intent: "Establish Authority (Trust building)",
    angle: "Data-Driven Insight",
    length: "Deep Dive (Long-form)",
    pov: "1st Person Plural (We) – Company/Team view",
  },
};

export interface SurpriseMeOptions {
  channel: Channel;
  rng?: RNG;
  maxRerolls?: number;
}

export function surpriseMe({
  channel,
  rng = Math.random,
  maxRerolls = 8,
}: SurpriseMeOptions): TraitState {
  const baseLengths = allowedLengths(channel);
  const channelPreferLengths = RULES.channelRules[channel]?.preferLengths ?? [];

  for (let attempt = 0; attempt <= maxRerolls; attempt++) {
    // 1) Category drives every other pick.
    const category = pick(TRAIT_OPTIONS.category, rng);
    const rule = RULES.categoryRules[category] ?? {};

    const combo: Combo = {
      category,
      voice: pick(weightedPool(TRAIT_OPTIONS.voice, rule.prefer?.voice, rule.avoid?.voice), rng),
      audience: pick(
        weightedPool(TRAIT_OPTIONS.audience, rule.prefer?.audience, rule.avoid?.audience),
        rng,
      ),
      intent: pick(
        weightedPool(TRAIT_OPTIONS.intent, rule.prefer?.intent, rule.avoid?.intent),
        rng,
      ),
      angle: pick(weightedPool(TRAIT_OPTIONS.angle, rule.prefer?.angle, rule.avoid?.angle), rng),
      length: pick(
        // Combine category-prefer + channel-prefer length lists.
        weightedPool(
          baseLengths,
          [...(rule.prefer?.length ?? []), ...channelPreferLengths],
          rule.avoid?.length,
        ),
        rng,
      ),
      pov: pick(weightedPool(TRAIT_OPTIONS.pov, rule.prefer?.pov, rule.avoid?.pov), rng),
    };

    if (violations(combo).length === 0) {
      return combo as TraitState;
    }
  }

  return { ...HOUSE_COMBO_BY_CHANNEL[channel] } as TraitState;
}

export const __test__ = {
  allowedLengths,
  violations,
  weightedPool,
  HOUSE_COMBO_BY_CHANNEL,
  RULES,
};
export type { TraitKey };
