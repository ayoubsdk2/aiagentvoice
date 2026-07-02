import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_EMAIL = "daniel@phaosai.com";
const DISCLAIMER = "AI-assisted content - human review recommended";

const SYSTEM_PROMPT = `You are a World-Class CMO and Brand Strategist for the commercial copier and managed-print industry, planning a 4-week social/blog cadence.

Voice: blend "Industrial Realist" (toner yields, click rates, MFP service intervals, paper-jam realities) with "Tech Visionary" (AI, automation, IoT-enabled fleets). Humorous, witty, authoritative — never corporate-fluffy. Use pattern-interrupt openers.

You will produce 8-12 posts spread across 4 weeks (2-3 posts per week). EXACTLY ONE post per week is a Faith pillar.

INDUSTRY POSTS:
- Target copier dealerships, print shops, MPS providers, IT decision-makers.
- Use sharp humor and wit.
- Tag the major OEMs naturally where it fits: @Ricoh @KonicaMinolta @Canon @Xerox (use the @ symbol; do not invent fake handles).
- Reference real industry pain (jams, click overage, fleet visibility, supply waste, service ETAs).

FAITH POSTS (exactly 1 per week, 4 total over 4 weeks):
- Quote ONE Scripture verse from the NIV translation only (include the reference, e.g. "Proverbs 3:5-6 (NIV)").
- Mention Jesus by name at least once.
- Offer spiritually empowering encouragement for working Christians in the print/tech industry.
- Bridge faith with the integrity of modern technology — honesty, stewardship, serving people well.
- DO NOT mention specific denominations (Catholic, Baptist, Pentecostal, etc.).
- DO NOT touch controversial theology (eschatology debates, predestination vs free will, political-religious topics, etc.).
- Keep it warm, ecumenical, and Christ-centered.

For EVERY post return:
- title (≤90 chars, SEO-aware)
- category: "industry" or "faith"
- week_index (1-4)
- day_of_week (0=Mon ... 6=Sun) — spread posts so faith posts are at least 5 days apart from each other
- linkedin_hook (STRICT: under 180 characters total including hashtags+spaces; end with hashtags relevant to the post — for industry posts include #ManagedPrint #PrintIndustry plus one more; for faith posts use #FaithAtWork #ChristianLeadership #IntegrityInTech)
- facebook_body (80-150 words, conversational, ends with a soft question)
- blog_body (500-800 words for bulk cadence — markdown allowed, ## H2s, pattern-interrupt opener, one concrete takeaway)
- seo_metadata: { meta_title (≤60), meta_description (≤155), keywords: 5-8 strings }

Return ONLY via the provided tool. No prose outside the tool call.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Auth gate ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "phaos_admin",
    });
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Input ----
    const body = await req.json().catch(() => ({}));
    const startDateStr = typeof body?.start_date === "string" ? body.start_date : null;
    const startDate = startDateStr ? new Date(startDateStr) : new Date();
    if (isNaN(startDate.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid start_date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Snap start to the next Monday (or today if Monday)
    const dow = (startDate.getDay() + 6) % 7; // 0=Mon
    const snapped = new Date(startDate);
    snapped.setDate(snapped.getDate() - dow);
    snapped.setHours(10, 0, 0, 0);

    // ---- Pull brand vault data points ----
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: vaultRows } = await adminClient
      .from("brand_vault")
      .select("id, content, source_url, category")
      .order("created_at", { ascending: false })
      .limit(50);

    const vaultBlock = vaultRows && vaultRows.length > 0
      ? `BRAND VAULT (cite where natural for industry posts):\n${vaultRows
          .slice(0, 8)
          .map((r, i) => `${i + 1}. [${r.category}] ${r.content}${r.source_url ? ` (src: ${r.source_url})` : ""}`)
          .join("\n")}`
      : `BRAND VAULT: empty — for industry posts, use clearly-flagged conservative estimates prefixed "Industry estimate:".`;

    const userPrompt = `Generate a 4-week content calendar.

START WEEK (Monday): ${snapped.toISOString().slice(0, 10)}

REQUIREMENTS:
- 8 to 12 posts total
- 2-3 posts per week
- EXACTLY 1 faith post per week (4 faith posts total)
- Faith posts must be at least 5 calendar days apart from each other
- Industry posts must collectively tag at least 3 of: @Ricoh, @KonicaMinolta, @Canon, @Xerox across the month (not in every post — make it natural)
- Vary topics: fleet visibility, click-rate economics, supply waste, AI dispatch, service SLAs, MPS sales motion, IT-buyer education, end-user pain
- Each post is publishable on LinkedIn + Facebook + as a blog

${vaultBlock}

Return via the emit_calendar tool.`;

    // ---- Call Lovable AI ----
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_calendar",
              description: "Return the 4-week content calendar.",
              parameters: {
                type: "object",
                properties: {
                  posts: {
                    type: "array",
                    minItems: 8,
                    maxItems: 12,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", maxLength: 120 },
                        category: { type: "string", enum: ["industry", "faith"] },
                        week_index: { type: "integer", minimum: 1, maximum: 4 },
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
                        "week_index",
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
        tool_choice: { type: "function", function: { name: "emit_calendar" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error", aiResp.status, text);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const argsStr = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      console.error("No tool call in AI response", JSON.stringify(aiJson).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI returned no structured output" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(argsStr) as {
      posts: Array<{
        title: string;
        category: "industry" | "faith";
        week_index: number;
        day_of_week: number;
        linkedin_hook: string;
        facebook_body: string;
        blog_body: string;
        seo_metadata: { meta_title: string; meta_description: string; keywords: string[] };
      }>;
    };

    // ---- Enforce LinkedIn 180-char ceiling ----
    const trimLinkedin = (text: string, category: "industry" | "faith") => {
      let s = text.trim();
      if (s.length <= 180) return s;
      const tags = category === "faith"
        ? "#FaithAtWork #ChristianLeadership #IntegrityInTech"
        : "#ManagedPrint #PrintIndustry #AIAutomation";
      const room = 180 - (tags.length + 1);
      const head = s.replace(/#\w+/g, "").trim().slice(0, Math.max(0, room - 1)).trim();
      return `${head} ${tags}`.trim();
    };

    // ---- Enforce faith spacing (>=5 days apart). If violated, nudge later faith posts forward. ----
    const dateFor = (week_index: number, day_of_week: number) => {
      const d = new Date(snapped);
      d.setDate(d.getDate() + (week_index - 1) * 7 + day_of_week);
      return d;
    };

    const posts = parsed.posts.map((p) => ({ ...p, scheduled_at: dateFor(p.week_index, p.day_of_week) }));
    posts.sort((a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime());

    let lastFaith: Date | null = null;
    for (const p of posts) {
      if (p.category !== "faith") continue;
      if (lastFaith) {
        const gapDays = (p.scheduled_at.getTime() - lastFaith.getTime()) / 86_400_000;
        if (gapDays < 5) {
          const nudged = new Date(lastFaith);
          nudged.setDate(nudged.getDate() + 5);
          p.scheduled_at = nudged;
        }
      }
      lastFaith = p.scheduled_at;
    }

    // ---- Insert into content_queue as drafts ----
    const rows = posts.map((p) => ({
      user_id: userData.user.id,
      title: p.title,
      scheduled_at: p.scheduled_at.toISOString(),
      post_type: "bulk" as const,
      category: p.category,
      blog_body: `${p.blog_body}\n\n---\n_${DISCLAIMER}_`,
      linkedin_hook: trimLinkedin(p.linkedin_hook, p.category),
      facebook_body: `${p.facebook_body}\n\n— ${DISCLAIMER}`,
      status: "draft" as const,
      seo_metadata: p.seo_metadata as unknown as Record<string, unknown>,
      platform_targets: { blog: true, linkedin: true, facebook: true } as Record<string, unknown>,
    }));

    const { data: inserted, error: insertErr } = await adminClient
      .from("content_queue")
      .insert(rows)
      .select("id, title, scheduled_at, category, status");

    if (insertErr) {
      console.error("insert error", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        inserted_count: inserted?.length ?? 0,
        posts: inserted ?? [],
        disclaimer: DISCLAIMER,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("content-lab-bulk-generate error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
