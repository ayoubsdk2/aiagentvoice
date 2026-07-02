/**
 * Predefined QA test specs for the Content Lab dashboard.
 * Each spec describes the input and expected output for one regeneration run.
 * The dashboard feeds these to `generateStyledCopy` and then to `qa-judge-output`.
 */

import type { TraitState } from "@/lib/content-lab/traits";
import { TRAIT_AUTO } from "@/lib/content-lab/traits";

export type TestCategory =
  | "trait_isolation"
  | "blended"
  | "surprise_me"
  | "four_week_strategy"
  | "webhook"
  | "linkedin_post";

export interface QATestSpec {
  id: string;
  category: TestCategory;
  label: string;
  description: string;
  fieldType: "blog_body" | "linkedin_hook" | "facebook_body" | "title";
  channel: "linkedin" | "facebook" | "blog";
  postTitle: string;
  postCategory: string;
  inputText: string;
  traits: TraitState;
  expected: string;
}

const baseTraits = (): TraitState => ({
  category: TRAIT_AUTO,
  voice: TRAIT_AUTO,
  audience: TRAIT_AUTO,
  intent: TRAIT_AUTO,
  angle: TRAIT_AUTO,
  length: TRAIT_AUTO,
  pov: TRAIT_AUTO,
});

const SAMPLE_BLOG = `Modern managed-print operations are a paradox: dealers obsess over click rates and toner yields, yet the people running them often feel called to something larger than ink margins. The truck rolls keep coming. The MFP fleet keeps misbehaving. And somewhere between the dispatch board and the CFO's quarterly review, the human element gets lost.

We've spent the last decade watching IT and faith collide on the same shop floor — engineers who pray over their pull requests, service techs who treat every fleet visit like a calling. The honest takeaway: stewardship of technology is not separate from the work. It IS the work.`;

export const TRAIT_ISOLATION_TESTS: QATestSpec[] = [
  {
    id: "iso-voice-technical",
    category: "trait_isolation",
    label: "Voice = Technical",
    description: "Output should add jargon, specificity, measurable terms; preserve theology.",
    fieldType: "blog_body",
    channel: "blog",
    postTitle: "Stewardship in Managed Print",
    postCategory: "industry",
    inputText: SAMPLE_BLOG,
    traits: { ...baseTraits(), voice: "Technical (Precision-focused)" },
    expected:
      "Adds technical specificity (e.g. CPP, MIF, SLA, ppm), measurable claims, and named protocols. Theology stays intact, not stripped.",
  },
  {
    id: "iso-audience-csuite",
    category: "trait_isolation",
    label: "Audience = C-Suite Executives",
    description: "Should center ROI, risk, strategic framing — minimal implementation detail.",
    fieldType: "blog_body",
    channel: "blog",
    postTitle: "Stewardship in Managed Print",
    postCategory: "industry",
    inputText: SAMPLE_BLOG,
    traits: { ...baseTraits(), audience: "C-Suite Executives (ROI focus)" },
    expected: "Leads with ROI/risk/strategy. Avoids low-level technical mechanics. Uses board-level language.",
  },
  {
    id: "iso-category-faith",
    category: "trait_isolation",
    label: "Category = Faith",
    description: "Output should lean theological, ecumenical, Christ-centered.",
    fieldType: "blog_body",
    channel: "blog",
    postTitle: "Stewardship in Managed Print",
    postCategory: "faith",
    inputText: SAMPLE_BLOG,
    traits: { ...baseTraits(), category: "Faith (Theology/Values)" },
    expected: "Foregrounds faith framing without denominational bias. Mentions Jesus or Scripture naturally.",
  },
  {
    id: "iso-intent-leads",
    category: "trait_isolation",
    label: "Intent = Generate Leads",
    description: "Should end with a clear CTA inviting inquiry.",
    fieldType: "linkedin_hook",
    channel: "linkedin",
    postTitle: "Cut Truck Rolls 30% with AI Dispatch",
    postCategory: "industry",
    inputText: "Truck rolls are killing your margin. There's a better way.",
    traits: { ...baseTraits(), intent: "Generate Leads (Inquiry focus)" },
    expected: "Ends with concrete CTA (DM, comment, link, demo). Inquiry-shaped, not just educational.",
  },
  {
    id: "iso-angle-data",
    category: "trait_isolation",
    label: "Angle = Data-Driven Insight",
    description: "Should center metrics, percentages, named studies or numbers.",
    fieldType: "blog_body",
    channel: "blog",
    postTitle: "Click Rate Economics",
    postCategory: "industry",
    inputText: SAMPLE_BLOG,
    traits: { ...baseTraits(), angle: "Data-Driven Insight" },
    expected: "Includes specific numbers, percentages, or industry estimates. Frames argument around evidence.",
  },
  {
    id: "iso-length-punchy",
    category: "trait_isolation",
    label: "Length = Punchy/Micro",
    description: "Should compress to 1-2 sentences with high impact.",
    fieldType: "linkedin_hook",
    channel: "linkedin",
    postTitle: "MFP Fleet Visibility",
    postCategory: "industry",
    inputText: "Most dealers can't tell you which MFP failed yesterday. Visibility wins.",
    traits: { ...baseTraits(), length: "Punchy/Micro (1\u20132 sentences)" },
    expected: "1-2 sentences total. Sharp opener, no filler.",
  },
  {
    id: "iso-pov-second-person",
    category: "trait_isolation",
    label: "POV = 2nd Person (You)",
    description: "Should address reader directly with 'you/your' framing.",
    fieldType: "facebook_body",
    channel: "facebook",
    postTitle: "Your MFP is Lying to You",
    postCategory: "industry",
    inputText: SAMPLE_BLOG,
    traits: { ...baseTraits(), pov: "2nd Person (You) – Direct advice to reader" },
    expected: "Heavy use of 'you / your'. Direct advice tone. No 'we/our' subject framing.",
  },
];

export const BLENDED_TESTS: QATestSpec[] = [
  {
    id: "blend-tactical-it",
    category: "blended",
    label: "Tactical / Technical / IT Managers / Data-Driven / Standard",
    description: "Expect: numbered steps, named protocols, ROI metrics, infra framing.",
    fieldType: "blog_body",
    channel: "blog",
    postTitle: "Hardening MFP Fleets Against Print Spool Exploits",
    postCategory: "industry",
    inputText: SAMPLE_BLOG,
    traits: {
      category: "Tactical (How-to/Tutorial)",
      voice: "Technical (Precision-focused)",
      audience: "IT Managers (Infrastructure focus)",
      intent: "Educate & Inform (Value-add)",
      angle: "Data-Driven Insight",
      length: "Standard Post (2\u20133 paragraphs)",
      pov: TRAIT_AUTO,
    },
    expected: "Step-by-step structure, infra/security vocab, named protocols, infra-manager framing.",
  },
  {
    id: "blend-faith-personal",
    category: "blended",
    label: "Faith / Empathetic / Faith Leaders / Personal Reflection / Short Narrative / 1st Person",
    description: "Expect: warm tone, first-person story, single Scripture reference.",
    fieldType: "blog_body",
    channel: "blog",
    postTitle: "What a Jammed MFP Taught Me About Patience",
    postCategory: "faith",
    inputText: SAMPLE_BLOG,
    traits: {
      category: "Faith (Theology/Values)",
      voice: "Empathetic (Understanding the struggle)",
      audience: "Faith-Driven Leaders (Purpose focus)",
      intent: "Inspire Reflection (Deep thought)",
      angle: "Personal Reflection",
      length: "Short Narrative",
      pov: "1st Person (I) – Personal experience",
    },
    expected: "First-person 'I' narrative, warm/empathetic, one NIV Scripture quote with reference.",
  },
  {
    id: "blend-product-csuite",
    category: "blended",
    label: "Product / Authoritative / C-Suite / Generate Leads / Problem-Solution / Punchy",
    description: "Expect: 1-2 sentences, problem framing, hard CTA, exec language.",
    fieldType: "linkedin_hook",
    channel: "linkedin",
    postTitle: "Eliminate Print Audit Risk Before Q4 Close",
    postCategory: "industry",
    inputText: "Print audit findings derail Q4 close. We make them disappear.",
    traits: {
      category: "Product/Service (Direct Sales)",
      voice: "Authoritative (The Expert)",
      audience: "C-Suite Executives (ROI focus)",
      intent: "Generate Leads (Inquiry focus)",
      angle: "Problem/Solution",
      length: "Punchy/Micro (1\u20132 sentences)",
      pov: TRAIT_AUTO,
    },
    expected: "Under 180 chars, problem-solution shape, executive vocabulary, hard CTA, no fluff.",
  },
];

export const ALL_QA_SPECS = [...TRAIT_ISOLATION_TESTS, ...BLENDED_TESTS];
