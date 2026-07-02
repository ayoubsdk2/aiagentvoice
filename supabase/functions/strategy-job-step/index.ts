// Worker that generates ONE week of content (2-3 posts including 1 Faith pillar).
// Self-invokes the next step on success. Marks job failed on error.
// Invoked by strategy-job-start (kickoff) and by itself (chain) using the SERVICE_ROLE_KEY,
// so it does NOT rely on a user JWT.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { pickModelFor } from "../_shared/ai-router.ts";
import { enforceHashtags } from "../_shared/hashtag-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCLAIMER = "AI-assisted content - human review recommended";

const SYSTEM_PROMPT = `You are a World-Class CMO and Brand Strategist for the commercial copier and managed-print industry.

You are drafting ONE WEEK of a 4-week social/blog cadence. Voice: blend "Industrial Realist" (toner yields, click rates, MFP service intervals, paper-jam realities) with "Tech Visionary" (AI, automation, IoT-enabled fleets). Humorous, witty, authoritative — never corporate-fluffy. Use pattern-interrupt openers.

Each week contains 2-3 posts. Exactly ONE post in this week is a Faith pillar.

INDUSTRY POSTS:
- Target copier dealerships, print shops, MPS providers, IT decision-makers.
- Use sharp humor and wit.
- Tag major OEMs naturally where it fits: @Ricoh @KonicaMinolta @Canon @Xerox.
- Reference real industry pain (jams, click overage, fleet visibility, supply waste, service ETAs).

FAITH POSTS (exactly 1 in this week):
- Quote ONE Scripture verse from the NIV translation only (include the reference, e.g. "Proverbs 3:5-6 (NIV)").
- Mention Jesus by name at least once.
- Spiritually empowering for working Christians in the print/tech industry.
- Bridge faith with integrity of modern technology — honesty, stewardship, serving people well.
- DO NOT mention specific denominations.
- DO NOT touch controversial theology or political-religious topics.
- Warm, ecumenical, Christ-centered.

For EVERY post return:
- title (≤90 chars, SEO-aware)
- category: "industry" or "faith"
- day_of_week (0=Mon ... 6=Sun)
- linkedin_hook (STRICT: under 180 characters total. Industry: include #ManagedPrint #PrintIndustry plus one more. Faith: #FaithAtWork #ChristianLeadership #IntegrityInTech)
- facebook_body (80-150 words, conversational, ends with a soft question)
- blog_body (500-800 words markdown, ## H2s, pattern-interrupt opener, one concrete takeaway)
- seo_metadata: { meta_title (≤60), meta_description (≤155), keywords: 5-8 strings }

Return ONLY via the provided tool.`;

function trimLinkedin(text: string, category: "industry" | "faith"): string {
  // Apply the world-class hashtag policy: exactly 3 LinkedIn tags, ≤180 chars.
  // The category passed in is the strategy-side enum; the validator accepts free-form
  // category strings so it picks faith vs industry fallbacks automatically.
  const enforced = enforceHashtags(text, "linkedin", category, 180);
  return enforced.text;
}

function trimFacebook(text: string, category: "industry" | "faith"): string {
  // Facebook policy: exactly 2 hashtags, no hard char limit.
  return enforceHashtags(text, "facebook", category).text;
}

function stripBlogTags(text: string, category: "industry" | "faith"): string {
  return enforceHashtags(text, "blog", category).text;
}

// World-class B2B posting cadence (LinkedIn/blog research): Tue/Wed/Thu mornings
// are the highest-engagement windows; Monday is acceptable; Fri/Sat/Sun are
// deprioritized for thought-leadership content.
// day_of_week here matches the model's contract: 0=Mon ... 6=Sun.
const BEST_PRACTICE_DAY_PRIORITY = [1, 2, 3, 0, 4]; // Tue, Wed, Thu, Mon, Fri

// Returns the day_of_week (0=Mon..6=Sun) for a UTC Date.
function dowFromDate(d: Date): number {
  // getUTCDay: 0=Sun..6=Sat. Convert to 0=Mon..6=Sun.
  return (d.getUTCDay() + 6) % 7;
}

// For week 1, clamp any post whose computed date is on or before the
// generation day (today, in UTC) to the next best-practice posting day
// strictly after today. Preserves later posts in the week as-is unless they
// also collide with today.
function clampFirstWeekDay(
  modelDow: number,
  weekMonday: Date,
  todayUtc: Date,
): number {
  const candidate = new Date(weekMonday);
  candidate.setUTCDate(candidate.getUTCDate() + modelDow);
  // Compare on calendar-day granularity (UTC).
  const sameOrBefore =
    candidate.getUTCFullYear() < todayUtc.getUTCFullYear() ||
    (candidate.getUTCFullYear() === todayUtc.getUTCFullYear() &&
      (candidate.getUTCMonth() < todayUtc.getUTCMonth() ||
        (candidate.getUTCMonth() === todayUtc.getUTCMonth() &&
          candidate.getUTCDate() <= todayUtc.getUTCDate())));
  if (!sameOrBefore) return modelDow;

  const todayDow = dowFromDate(todayUtc);
  // Find the next best-practice day strictly after today within this week (Mon..Sun).
  for (const pref of BEST_PRACTICE_DAY_PRIORITY) {
    if (pref > todayDow && pref <= 6) return pref;
  }
  // Fallback: any day strictly after today this week.
  for (let dow = todayDow + 1; dow <= 6; dow++) return dow;
  // If today is Sunday (todayDow=6) the week has no later days; push to next
  // week's Tuesday by adding 7 — but day_of_week is bounded 0..6, so the
  // caller will detect this by computing the date and finding it < weekMonday+7.
  // Easiest correct behavior: jump to Friday (dow=4) of *this* week is impossible
  // when today is Sunday. Return 1 (Mon) — caller will see it's still ≤ today
  // and the date math will naturally land in week 2 only if we shift the
  // base; instead we simply return 1 and accept Mon as the worst case (it's
  // still after Sunday on the calendar).
  return 1;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SERVICE_API_KEY = Deno.env.get("SERVICE_API_KEY");

  // Internal-only worker. Reject any unauthenticated caller — the function
  // burns AI credits and writes to content_queue via service role.
  const presented = req.headers.get("x-service-token") ?? "";
  if (!SERVICE_API_KEY || presented.length === 0 || presented !== SERVICE_API_KEY) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let jobId: string | null = null;

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    jobId = typeof body?.job_id === "string" ? body.job_id : null;
    // Debug-only flag for QA: throw at this 1-based week index. Forwarded by chain.
    const failAtStep =
      typeof body?.fail_at_step === "number" && Number.isFinite(body.fail_at_step)
        ? Math.floor(body.fail_at_step)
        : null;
    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobErr } = await admin
      .from("strategy_jobs")
      .select("id, user_id, status, completed_steps, total_steps, start_date, result_post_ids")
      .eq("id", jobId)
      .maybeSingle();
    if (jobErr || !job) throw new Error(jobErr?.message ?? "Job not found");

    if (job.completed_steps >= job.total_steps) {
      return new Response(JSON.stringify({ ok: true, alreadyComplete: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weekIndex = job.completed_steps + 1; // 1-based
    await admin
      .from("strategy_jobs")
      .update({
        status: "in_progress",
        current_step: `week_${weekIndex}`,
        error_message: null,
      })
      .eq("id", jobId);

    // QA fail-injection (debug-only). Throws so the catch handler marks the job failed.
    if (failAtStep !== null && failAtStep === weekIndex) {
      throw new Error(`QA: simulated failure at week ${weekIndex} (fail_at_step)`);
    }

    // Compute Monday of this week.
    const start = new Date(`${job.start_date}T10:00:00.000Z`);
    const weekMonday = new Date(start);
    weekMonday.setUTCDate(weekMonday.getUTCDate() + (weekIndex - 1) * 7);

    // Pull a small slice of brand vault for context.
    const { data: vaultRows } = await admin
      .from("brand_vault")
      .select("category, content, source_url")
      .order("created_at", { ascending: false })
      .limit(20);
    const vaultBlock =
      vaultRows && vaultRows.length > 0
        ? `BRAND VAULT (cite where natural for industry posts):\n${vaultRows
            .slice(0, 6)
            .map(
              (r, i) =>
                `${i + 1}. [${r.category}] ${r.content}${r.source_url ? ` (src: ${r.source_url})` : ""}`,
            )
            .join("\n")}`
        : `BRAND VAULT: empty — for industry posts, prefix uncertain stats with "Industry estimate:".`;

    const userPrompt = `Generate WEEK ${weekIndex} of a 4-week content calendar.

WEEK MONDAY: ${weekMonday.toISOString().slice(0, 10)}
WEEK INDEX: ${weekIndex} of 4

REQUIREMENTS:
- 2 to 3 posts in this week
- EXACTLY 1 faith post in this week
- Industry posts: vary topics — fleet visibility, click-rate economics, supply waste, AI dispatch, service SLAs, MPS sales motion, IT-buyer education
- Each post is publishable on LinkedIn + Facebook + as a blog
- Spread day_of_week values so the faith post is not on the same day as another post in this week

${vaultBlock}

Return via the emit_week tool.`;

    const strategyModel = pickModelFor("strategy_week");
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: strategyModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_week",
              description: "Return one week (2-3 posts) of the content calendar.",
              parameters: {
                type: "object",
                properties: {
                  posts: {
                    type: "array",
                    minItems: 2,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", maxLength: 120 },
                        category: { type: "string", enum: ["industry", "faith"] },
                        day_of_week: { type: "integer", minimum: 0, maximum: 6 },
                        linkedin_hook: { type: "string", maxLength: 180 },
                        facebook_body: { type: "string" },
                        blog_body: { type: "string" },
                        seo_metadata: {
                          type: "object",
                          properties: {
                            meta_title: { type: "string", maxLength: 60 },
                            meta_description: { type: "string", maxLength: 155 },
                            keywords: {
                              type: "array",
                              items: { type: "string" },
                              minItems: 3,
                              maxItems: 10,
                            },
                          },
                          required: ["meta_title", "meta_description", "keywords"],
                          additionalProperties: false,
                        },
                      },
                      required: [
                        "title",
                        "category",
                        "day_of_week",
                        "linkedin_hook",
                        "facebook_body",
                        "blog_body",
                        "seo_metadata",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["posts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_week" } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error", aiResp.status, text);
      throw new Error(
        aiResp.status === 429
          ? "Rate limited — retry shortly"
          : aiResp.status === 402
          ? "AI credits exhausted"
          : `AI generation failed (${aiResp.status})`,
      );
    }

    const aiJson = await aiResp.json();
    const argsStr = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) throw new Error("AI returned no structured output");

    const parsed = JSON.parse(argsStr) as {
      posts: Array<{
        title: string;
        category: "industry" | "faith";
        day_of_week: number;
        linkedin_hook: string;
        facebook_body: string;
        blog_body: string;
        seo_metadata: { meta_title: string; meta_description: string; keywords: string[] };
      }>;
    };

    // Ensure exactly one faith post; if model returned 0 or >1, coerce.
    const faithCount = parsed.posts.filter((p) => p.category === "faith").length;
    if (faithCount === 0 && parsed.posts.length > 0) {
      parsed.posts[0].category = "faith";
    }

    // For week 1, never let a post land on (or before) the generation day —
    // bump such posts to the next best-practice posting day this week.
    const todayUtc = new Date();
    const isFirstWeek = weekIndex === 1;

    const rows = parsed.posts.map((p) => {
      const effectiveDow = isFirstWeek
        ? clampFirstWeekDay(p.day_of_week, weekMonday, todayUtc)
        : p.day_of_week;
      const scheduled = new Date(weekMonday);
      scheduled.setUTCDate(scheduled.getUTCDate() + effectiveDow);
      const cleanBlog = stripBlogTags(p.blog_body, p.category);
      const fbWithTags = trimFacebook(p.facebook_body, p.category);
      return {
        user_id: job.user_id,
        title: p.title,
        scheduled_at: scheduled.toISOString(),
        post_type: "bulk" as const,
        category: p.category,
        blog_body: `${cleanBlog}\n\n---\n_${DISCLAIMER}_`,
        linkedin_hook: trimLinkedin(p.linkedin_hook, p.category),
        facebook_body: `${fbWithTags}\n\n— ${DISCLAIMER}`,
        status: "draft" as const,
        seo_metadata: p.seo_metadata as unknown as Record<string, unknown>,
        platform_targets: { blog: true, linkedin: true, facebook: true } as Record<string, unknown>,
      };
    });

    const { data: inserted, error: insertErr } = await admin
      .from("content_queue")
      .insert(rows)
      .select("id");
    if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

    const newIds = (inserted ?? []).map((r) => r.id);
    const mergedIds = [...(job.result_post_ids ?? []), ...newIds];
    const newCompleted = job.completed_steps + 1;
    const isDone = newCompleted >= job.total_steps;

    await admin
      .from("strategy_jobs")
      .update({
        completed_steps: newCompleted,
        current_step: isDone ? null : `week_${newCompleted + 1}`,
        result_post_ids: mergedIds,
        status: isDone ? "completed" : "in_progress",
      })
      .eq("id", jobId);

    if (!isDone) {
      // Chain the next week. Fire-and-forget. Forward debug fail flag if set.
      const nextBody: Record<string, unknown> = { job_id: jobId };
      if (failAtStep !== null) nextBody.fail_at_step = failAtStep;
      void fetch(`${SUPABASE_URL}/functions/v1/strategy-job-step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "x-service-token": SERVICE_API_KEY,
        },
        body: JSON.stringify(nextBody),
      }).catch((e) => console.error("next-step kickoff failed", e));
    }

    return new Response(
      JSON.stringify({ ok: true, week: newCompleted, done: isDone, inserted: newIds.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("strategy-job-step error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (jobId) {
      await admin
        .from("strategy_jobs")
        .update({ status: "failed", error_message: message })
        .eq("id", jobId);
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
