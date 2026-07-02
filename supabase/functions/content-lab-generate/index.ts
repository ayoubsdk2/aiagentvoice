import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_EMAIL = "daniel@phaosai.com";
const DISCLAIMER = "AI-assisted content - human review recommended";

const SYSTEM_PROMPT = `You are a World-Class CMO and Brand Strategist for the commercial copier and managed-print industry.
Your voice blends "Industrial Realist" (knows toner yields, click rates, MFP service intervals, paper-jam realities) with "Tech Visionary" (bold, future-leaning takes on AI, automation, IoT-enabled fleets). You are humorous yet authoritative — never corporate-fluffy, never cringe.

You write for print/copier dealers, IT decision-makers, and operations leaders. Every piece must be:
- Specific (real numbers, real workflows, real machine behavior)
- Differentiated (a pattern-interrupt opening, a fresh angle)
- Useful (one concrete takeaway the reader can act on)

You will be given a topic, a target audience hint, and ONE data point pulled from the brand's internal "Brand Vault" — you MUST cite that data point naturally inside the blog. Do not invent statistics outside it.

Return ONLY a JSON object via the provided tool. No prose outside the tool call.`;

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
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Auth check (gate to allowed email) ----
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

    // ---- Parse + validate input ----
    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const category = body?.category === "faith" ? "faith" : "industry";
    if (!title || title.length > 200) {
      return new Response(
        JSON.stringify({ error: "title is required and must be <= 200 chars" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Pull a data point from brand_vault (service role to bypass RLS for admin caller verified above) ----
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: vaultRows } = await adminClient
      .from("brand_vault")
      .select("id, category, content, source_url")
      .eq("category", "data_point")
      .order("created_at", { ascending: false })
      .limit(25);

    let chosenDataPoint: { content: string; source_url: string | null } | null = null;
    if (vaultRows && vaultRows.length > 0) {
      const pick = vaultRows[Math.floor(Math.random() * vaultRows.length)];
      chosenDataPoint = { content: pick.content, source_url: pick.source_url };
    }

    const dataPointBlock = chosenDataPoint
      ? `BRAND VAULT DATA POINT (cite this naturally inside the blog body):
"""
${chosenDataPoint.content}
${chosenDataPoint.source_url ? `Source: ${chosenDataPoint.source_url}` : ""}
"""`
      : `BRAND VAULT DATA POINT: (none available — use a clearly-flagged, conservative industry estimate and prefix it with "Industry estimate:" so reviewers can verify.)`;

    const userPrompt = `TOPIC / TITLE: ${title}
CATEGORY: ${category === "faith" ? "Faith-driven leadership angle for the print industry" : "Industry / managed-print operations"}

${dataPointBlock}

DELIVERABLES (return via the tool):

1) blog_body — ~1,200 words (1,100–1,300 acceptable). SEO-optimized for the title above. Markdown allowed (## H2s, ### H3s, bold). Must:
   - Open with a pattern-interrupt hook (no "In today's fast-paced world…" garbage).
   - Cite the brand vault data point naturally in-line.
   - Include 3–5 H2 sections.
   - End with a concrete, actionable takeaway.

2) linkedin_hook — STRICT: under 180 characters TOTAL including hashtags and spaces. Witty, pattern-interrupt opener. MUST end with these three hashtags exactly: #ManagedPrint #PrintIndustry #AIAutomation. Count characters carefully — under 180 is non-negotiable.

3) facebook_body — 80–150 words. Conversational, slightly more accessible than LinkedIn. One emoji max. End with a soft question to drive comments.

4) seo_metadata — { meta_title (<=60 chars), meta_description (<=155 chars), keywords: string[] (5–8 items) }.

Voice: Industrial Realist x Tech Visionary. Humorous, authoritative, specific. No corporate fluff. No em-dash overuse.`;

    // ---- Call Lovable AI Gateway with tool-calling for structured output ----
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
              name: "emit_post",
              description: "Return the generated blog post, LinkedIn hook, Facebook body, and SEO metadata.",
              parameters: {
                type: "object",
                properties: {
                  blog_body: { type: "string" },
                  linkedin_hook: { type: "string", maxLength: 180 },
                  facebook_body: { type: "string" },
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
                required: ["blog_body", "linkedin_hook", "facebook_body", "seo_metadata"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_post" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      console.error("No tool call in AI response", JSON.stringify(aiJson).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI returned no structured output" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = JSON.parse(argsStr) as {
      blog_body: string;
      linkedin_hook: string;
      facebook_body: string;
      seo_metadata: { meta_title: string; meta_description: string; keywords: string[] };
    };

    // Hard-enforce LinkedIn 180-char ceiling. If the model overshot, trim safely.
    let linkedin = parsed.linkedin_hook.trim();
    if (linkedin.length > 180) {
      const tags = "#ManagedPrint #PrintIndustry #AIAutomation";
      const room = 180 - (tags.length + 1);
      const head = linkedin.replace(/#\w+/g, "").trim().slice(0, Math.max(0, room - 1)).trim();
      linkedin = `${head} ${tags}`.trim();
    }

    return new Response(
      JSON.stringify({
        title,
        category,
        blog_body: `${parsed.blog_body}\n\n---\n_${DISCLAIMER}_`,
        linkedin_hook: linkedin,
        facebook_body: `${parsed.facebook_body}\n\n— ${DISCLAIMER}`,
        seo_metadata: parsed.seo_metadata,
        disclaimer: DISCLAIMER,
        brand_vault_source: chosenDataPoint?.source_url ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("content-lab-generate error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
