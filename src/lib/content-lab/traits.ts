/**
 * Single source of truth for the 7 ContentSwissArmyKnife trait taxonomies.
 * Labels are the literal strings sent into the LLM prompt — DO NOT rename
 * without coordinated edge-function + test updates.
 */

export const TRAIT_AUTO = "Auto" as const;

export type TraitKey =
  | "category"
  | "voice"
  | "audience"
  | "intent"
  | "angle"
  | "length"
  | "pov";

export type TraitValue = string;

export const TRAIT_OPTIONS: Record<TraitKey, readonly string[]> = {
  category: [
    "Industry (Standard Tech/MPS)",
    "Faith (Theology/Values)",
    "Leadership (Management/Culture)",
    "Tactical (How-to/Tutorial)",
    "Case Study (Success Stories)",
    "Personal (Founder's Journey)",
    "News/Trends (Current Events)",
    "Product/Service (Direct Sales)",
    "Community (Social Proof/Events)",
    "Security/Policy (Compliance focus)",
  ],
  voice: [
    "Authoritative (The Expert)",
    "Winsome (Warm & Appealing)",
    "Provocative (The Challenger)",
    "Empathetic (Understanding the struggle)",
    "Technical (Precision-focused)",
    "Visionary (Looking forward)",
    "Witty (Smart humor)",
    "Grounded (Practical/Common sense)",
    "Academic (Deeply researched)",
    "Urgent (High energy/Alert)",
  ],
  audience: [
    "C-Suite Executives (ROI focus)",
    "IT Managers (Infrastructure focus)",
    "End Users (Ease-of-use focus)",
    "Procurement Officers (Cost/SLA focus)",
    "Field Technicians (Implementation focus)",
    "Faith-Driven Leaders (Purpose focus)",
    "Small Business Owners (Efficiency focus)",
    "Sales Professionals (Growth focus)",
    "Skeptics/Critics (Evidence focus)",
    "Potential Recruits (Culture focus)",
  ],
  intent: [
    "Start a Conversation (Engagement)",
    "Educate & Inform (Value-add)",
    "Generate Leads (Inquiry focus)",
    "Establish Authority (Trust building)",
    "Inspire Reflection (Deep thought)",
    "Drive Web Traffic (Link-click focus)",
    "Myth-Busting (Correcting misconceptions)",
    "Recruitment (Attracting talent)",
    "Announce/Launch (Excitement)",
    "Nurture Relationships (Loyalty)",
  ],
  angle: [
    "Problem/Solution",
    "The \"Hard Truth\" (Contrarian)",
    "Before & After (Transformation)",
    "Behind the Scenes (Transparency)",
    "The \"Why\" vs. The \"How\"",
    "Future Predictions",
    "Personal Reflection",
    "Data-Driven Insight",
    "Step-by-Step Guide",
    "The Parable (Metaphor-heavy)",
  ],
  length: [
    "Punchy/Micro (1–2 sentences)",
    "Standard Post (2–3 paragraphs)",
    "The \"LinkedIn Bro\" (Heavy white space)",
    "Bullet-Point Summary",
    "Deep Dive (Long-form)",
    "The \"TL;DR\" (Short summary first)",
    "Headline/Hook Only",
    "Two-Part Series (Part 1)",
    "Short Narrative",
    "Actionable Checklist",
  ],
  pov: [
    "1st Person (I) – Personal experience",
    "1st Person Plural (We) – Company/Team view",
    "2nd Person (You) – Direct advice to reader",
    "3rd Person (They) – Case study/External view",
    "The Outsider – Objective observation",
    "The Mentor – Guiding/Teaching",
    "The Peer – Collaborative/Relatable",
    "The Visionary – Future-casting",
    "The Customer – Benefits-first perspective",
    "The Skeptic – Playing Devil's Advocate",
  ],
};

export const TRAIT_LABELS: Record<TraitKey, string> = {
  category: "Category",
  voice: "Voice",
  audience: "Audience",
  intent: "Intent",
  angle: "Angle",
  length: "Length",
  pov: "POV",
};

/** Prompt-side keys the edge function expects (matches Daniel's spec). */
export const TRAIT_PROMPT_KEYS: Record<TraitKey, string> = {
  category: "trait_category_pillar",
  voice: "trait_voice",
  audience: "trait_audience",
  intent: "trait_intent",
  angle: "trait_angle",
  length: "trait_length_format",
  pov: "trait_pov",
};

export type TraitState = Record<TraitKey, string>; // value or "Auto"

export function defaultTraitState(): TraitState {
  return {
    category: TRAIT_AUTO,
    voice: TRAIT_AUTO,
    audience: TRAIT_AUTO,
    intent: TRAIT_AUTO,
    angle: TRAIT_AUTO,
    length: TRAIT_AUTO,
    pov: TRAIT_AUTO,
  };
}

export const TRAIT_KEYS: TraitKey[] = [
  "category",
  "voice",
  "audience",
  "intent",
  "angle",
  "length",
  "pov",
];
