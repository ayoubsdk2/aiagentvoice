import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";
import { pickModelFor, type RouterFeature } from "../_shared/ai-router.ts";
import { enforceHashtags, type HashtagChannel } from "../_shared/hashtag-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_EMAIL = "daniel@phaosai.com";
const AUTO = "Auto";

const TraitSchema = z.object({
  trait_category_pillar: z.string().min(1).max(120).default(AUTO),
  trait_voice: z.string().min(1).max(120).default(AUTO),
  trait_audience: z.string().min(1).max(120).default(AUTO),
  trait_intent: z.string().min(1).max(120).default(AUTO),
  trait_angle: z.string().min(1).max(120).default(AUTO),
  trait_length_format: z.string().min(1).max(120).default(AUTO),
  trait_pov: z.string().min(1).max(120).default(AUTO),
});

const BodySchema = z.object({
  fieldType: z.enum(["linkedin_hook", "facebook_body", "blog_markdown"]),
  postId: z.string().uuid().optional().nullable(),
  postTitle: z.string().min(1).max(300),
  postCategory: z.string().min(1).max(60),
  originalText: z.string().max(20_000).default(""),
  traits: TraitSchema,
  channel: z.enum(["linkedin", "facebook", "blog"]),
  surprise: z.boolean().optional().default(false),
});

type Body = z.infer<typeof BodySchema>;

const SYSTEM_PROMPT = `You are Phaos AI's Content Lab Swiss Army Knife. You rewrite ONE field of a faith-driven tech & leadership post for the Phaos brand.

Brand voice rules:
- Ethically serious, technically credible, humble, spiritually grounded.
- Never preachy. Never gimmicky. Never prosperity-gospel. No corporate fluff.
- LinkedIn hook MUST be ≤180 characters TOTAL (including hashtags & spaces) AND end with EXACTLY 3 niche hashtags.
- Facebook body: conversational, 80–150 words, ≤1 emoji, soft question to drive comments, end with EXACTLY 2 hashtags.
- Blog body is valid Markdown; H2s allowed; no front-matter; ZERO hashtags anywhere.
- If category=Faith, integrate scripture naturally; never quote-mine; no chapter-and-verse spam.

You will receive 7 trait controls. Each is either a literal style choice OR the string "Auto". When a trait = "Auto", infer a sensible value from the title + original text + channel. When a trait is set, treat it as a hard styling/structural constraint.

Adjust jargon to the chosen Audience.
Preserve technical and theological accuracy.

Output ONLY the regenerated text for the requested field. No preamble, no explanations, no JSON wrapping.`;

function buildUserPrompt(b: Body): string {
  const lines: string[] = [];
  lines.push(`POST TITLE: ${b.postTitle}`);
  lines.push(`POST CATEGORY: ${b.postCategory}`);
  lines.push(`CHANNEL: ${b.channel}`);
  lines.push(`FIELD TO REWRITE: ${b.fieldType}`);
  lines.push("");
  lines.push("TRAIT CONTROLS:");
  for (const [k, v] of Object.entries(b.traits)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push("");
  lines.push("CURRENT TEXT (rewrite this):");
  lines.push(`"""\n${b.originalText || "(empty — generate from title + traits)"}\n"""`);
  lines.push("");
  if (b.fieldType === "linkedin_hook") {
    lines.push("Hard limit: ≤180 chars including hashtags. EXACTLY 3 hashtags.");
  } else if (b.fieldType === "facebook_body") {
    lines.push("Hard limit: 80–150 words, ≤1 emoji, EXACTLY 2 hashtags, end with a soft question.");
  } else {
    lines.push("Markdown blog body. 3–5 H2 sections. End with one concrete takeaway. ZERO hashtags.");
  }
  lines.push("");
  lines.push("Return ONLY the regenerated text. No quotes around it. No explanations.");
  return lines.join("\n");
}

function pickModel(b: Body): string {
  // Surprise mode pushes to creative tier regardless of channel.
  if (b.surprise) return pickModelFor("surprise");

  // Long-form length traits force the deep-tier model even on social channels.
  const length = b.traits.trait_length_format ?? "";
  if (length.startsWith("Deep Dive") || length.startsWith("Two-Part")) {
    return pickModelFor("regen_blog");
  }

  const featureByField: Record<Body["fieldType"], RouterFeature> = {
    linkedin_hook: "regen_linkedin",
    facebook_body: "regen_facebook",
    blog_markdown: "regen_blog",
  };
  return pickModelFor(featureByField[b.fieldType]);
}

function channelFromField(field: Body["fieldType"]): HashtagChannel {
  if (field === "linkedin_hook") return "linkedin";
  if (field === "facebook_body") return "facebook";
  return "blog";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  let userId: string | null = null;
  let parsed: Body | null = null;
  let chosenModel = "unknown";

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
    userId = userData.user.id;

    const raw = await req.json().catch(() => ({}));
    const validated = BodySchema.safeParse(raw);
    if (!validated.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: validated.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    parsed = validated.data;
    chosenModel = pickModel(parsed);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(parsed) },
        ],
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
    let text = aiJson?.choices?.[0]?.message?.content as string | undefined;
    if (!text || typeof text !== "string") {
      console.error("Empty AI response", JSON.stringify(aiJson).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI returned no text" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    text = text.trim();

    // Enforce the world-class hashtag policy (LI=3, FB=2, Blog=0) and the 180-char LinkedIn limit.
    const channel = channelFromField(parsed.fieldType);
    const maxLen = parsed.fieldType === "linkedin_hook" ? 180 : undefined;
    const enforced = enforceHashtags(text, channel, parsed.postCategory, maxLen);
    text = enforced.text;

    // Audit log (best-effort, never block response).
    try {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await adminClient.from("audit_events").insert({
        actor_user_id: userId,
        actor_type: "user",
        action: "content_lab.regenerate",
        resource_type: "content_queue",
        resource_id: parsed.postId ?? null,
        metadata: {
          field: parsed.fieldType,
          channel: parsed.channel,
          model: chosenModel,
          duration_ms: Date.now() - startedAt,
          surprise: !!parsed.surprise,
          traits: parsed.traits,
          hashtags_applied: enforced.tagsApplied,
          hashtag_policy_changed: enforced.changed,
        },
      });
    } catch (auditErr) {
      console.warn("audit insert failed", auditErr);
    }

    return new Response(
      JSON.stringify({
        text,
        model: chosenModel,
        traitsUsed: parsed.traits,
        durationMs: Date.now() - startedAt,
        hashtagsApplied: enforced.tagsApplied,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("content-lab-regenerate error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
