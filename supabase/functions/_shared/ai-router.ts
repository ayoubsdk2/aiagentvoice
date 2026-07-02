/**
 * Centralized AI model router for all Content Lab generations.
 *
 * Goals:
 *  - Single source of truth for which model handles which feature.
 *  - Per-feature env-var overrides so we can A/B without redeploying logic.
 *  - All calls go through Lovable AI Gateway (no client-side keys, ever).
 *
 * Env override precedence (per feature key):
 *   MODEL_<FEATURE>  →  feature default  →  global fallback
 *
 * Recognized feature keys:
 *   regen_linkedin   — short tactical hook regeneration
 *   regen_facebook   — conversational body regeneration
 *   regen_blog       — long-form blog body regeneration
 *   strategy_week    — one week of the 4-week strategy (structured)
 *   surprise         — Surprise Me / creative push
 */

export type RouterFeature =
  | "regen_linkedin"
  | "regen_facebook"
  | "regen_blog"
  | "strategy_week"
  | "surprise";

const FAST = "google/gemini-2.5-flash";
const DEEP = "openai/gpt-5";
const CREATIVE = "google/gemini-2.5-pro";

const DEFAULTS: Record<RouterFeature, string> = {
  regen_linkedin: FAST,
  regen_facebook: FAST,
  regen_blog: DEEP,
  strategy_week: DEEP,
  surprise: CREATIVE,
};

const ENV_KEYS: Record<RouterFeature, string> = {
  regen_linkedin: "MODEL_REGEN_LINKEDIN",
  regen_facebook: "MODEL_REGEN_FACEBOOK",
  regen_blog: "MODEL_REGEN_BLOG",
  strategy_week: "MODEL_STRATEGY_WEEK",
  surprise: "MODEL_SURPRISE",
};

/**
 * Resolve the model id to use for a given Content Lab feature.
 * Reads `MODEL_<FEATURE>` from the runtime env first, otherwise returns the
 * built-in default.
 */
export function pickModelFor(feature: RouterFeature): string {
  const envKey = ENV_KEYS[feature];
  const override = Deno.env.get(envKey);
  if (override && override.trim().length > 0) return override.trim();
  return DEFAULTS[feature];
}

/** Exposed for tests and observability. */
export const __routerInternals = { DEFAULTS, ENV_KEYS };
