/**
 * Hashtag policy enforcement for Content Lab outputs.
 *
 * Rule (locked in by product owner):
 *   LinkedIn hooks  → exactly 3 niche tags, appended at the end.
 *   Facebook bodies → exactly 2 conversational tags, appended at the end.
 *   Blog bodies     → 0 hashtags (SEO handled via metadata.keywords).
 *
 * The validator never invents tags out of thin air — it relies on category-aware
 * fallbacks when the model under-tagged, and trims overflow from the right when
 * the model over-tagged.
 */

export type HashtagChannel = "linkedin" | "facebook" | "blog";
export type HashtagCategory = string; // free-form (matches TraitState.category)

const TARGET: Record<HashtagChannel, number> = {
  linkedin: 3,
  facebook: 2,
  blog: 0,
};

/** Per-category fallback tags, ordered by relevance. */
const CATEGORY_FALLBACKS: Array<{ match: RegExp; tags: string[] }> = [
  {
    match: /faith|theolog/i,
    tags: ["#FaithAtWork", "#ChristianLeadership", "#IntegrityInTech"],
  },
  {
    match: /leader|management|culture/i,
    tags: ["#Leadership", "#Culture", "#ExecLeadership"],
  },
  {
    match: /tactical|how[- ]?to|tutorial/i,
    tags: ["#HowTo", "#PrintOps", "#FieldService"],
  },
  {
    match: /case study|success/i,
    tags: ["#CaseStudy", "#CustomerStory", "#PrintIndustry"],
  },
  {
    match: /security|policy|compliance/i,
    tags: ["#PrintSecurity", "#Compliance", "#ITGovernance"],
  },
  {
    match: /news|trend|event/i,
    tags: ["#PrintIndustry", "#Trends", "#MPS"],
  },
  {
    match: /community|social proof/i,
    tags: ["#Community", "#PrintIndustry", "#Dealers"],
  },
  {
    match: /personal|founder/i,
    tags: ["#FoundersJourney", "#BuildInPublic", "#Leadership"],
  },
  {
    match: /product|service|sales/i,
    tags: ["#ManagedPrint", "#PrintIndustry", "#MPS"],
  },
];

const DEFAULT_TAGS = ["#ManagedPrint", "#PrintIndustry", "#AIAutomation"];

/** Return up to N category-appropriate tags, never duplicating existing ones. */
function fallbackTagsFor(category: HashtagCategory, existing: string[], need: number): string[] {
  if (need <= 0) return [];
  const existingLower = new Set(existing.map((t) => t.toLowerCase()));
  const pool = CATEGORY_FALLBACKS.find((c) => c.match.test(category))?.tags ?? DEFAULT_TAGS;
  const out: string[] = [];
  for (const t of pool) {
    if (out.length >= need) break;
    if (!existingLower.has(t.toLowerCase())) out.push(t);
  }
  // If the pool was too small, top up from defaults.
  for (const t of DEFAULT_TAGS) {
    if (out.length >= need) break;
    if (!existingLower.has(t.toLowerCase()) && !out.some((x) => x.toLowerCase() === t.toLowerCase())) {
      out.push(t);
    }
  }
  return out.slice(0, need);
}

/** Extract hashtags in order of first appearance. */
function extractTags(text: string): string[] {
  const matches = text.match(/#[A-Za-z0-9_]+/g) ?? [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const m of matches) {
    const k = m.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      ordered.push(m);
    }
  }
  return ordered;
}

function stripTags(text: string): string {
  return text.replace(/#[A-Za-z0-9_]+/g, "").replace(/\s{2,}/g, " ").trim();
}

export interface EnforceResult {
  text: string;
  tagsApplied: string[];
  changed: boolean;
}

/**
 * Enforce the hashtag policy for a single piece of generated copy.
 *
 * @param text     The raw model output.
 * @param channel  Which channel this copy is for.
 * @param category The post's content category (used for fallback tags).
 * @param maxLen   Optional hard char-limit (LinkedIn = 180).
 */
export function enforceHashtags(
  text: string,
  channel: HashtagChannel,
  category: HashtagCategory,
  maxLen?: number,
): EnforceResult {
  const target = TARGET[channel];
  const original = text;
  const found = extractTags(text);

  if (channel === "blog") {
    // Blogs: zero tags. Just strip them.
    const cleaned = stripTags(text);
    return { text: cleaned, tagsApplied: [], changed: cleaned !== original };
  }

  let tags: string[];
  if (found.length === target) {
    tags = found;
  } else if (found.length > target) {
    tags = found.slice(0, target);
  } else {
    tags = [...found, ...fallbackTagsFor(category, found, target - found.length)];
  }

  const body = stripTags(text);
  let composed = `${body} ${tags.join(" ")}`.replace(/\s+/g, " ").trim();

  if (maxLen && composed.length > maxLen) {
    const tagSuffix = tags.join(" ");
    const room = maxLen - tagSuffix.length - 1;
    const trimmedBody = body.slice(0, Math.max(0, room)).trim();
    composed = `${trimmedBody} ${tagSuffix}`.trim();
  }

  return { text: composed, tagsApplied: tags, changed: composed !== original };
}
