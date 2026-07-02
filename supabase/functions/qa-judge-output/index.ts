// LLM-as-judge for Content Lab QA. Scores how well a regenerated text reflects
// the requested traits. Returns 1-5 score + rationale per trait.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface JudgePayload {
  input_text: string;
  output_text: string;
  traits: Record<string, string>;
  expected?: string;
}

const SYSTEM = `You are a strict editorial QA judge for B2B content.
Given an input text, an AI-rewritten output text, and a set of trait targets,
score the output on a 1-5 scale per trait:
  1 = trait clearly absent / contradicted
  2 = barely present
  3 = partially present
  4 = clearly present
  5 = exemplary execution of that trait
Then return an overall PASS (>=3.5 average) or FAIL.
Be rigorous and unbiased — flag bland output, broken markdown, lost meaning.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth + admin gate.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: u.user.id,
      _role: "phaos_admin",
    });
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "phaos_admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as JudgePayload;
    if (!body?.output_text || !body?.traits) {
      return new Response(JSON.stringify({ error: "output_text and traits required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const traitsList = Object.entries(body.traits)
      .filter(([, v]) => v && v !== "Auto")
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");

    const userPrompt = `INPUT TEXT:
"""
${body.input_text || "(none provided)"}
"""

OUTPUT TEXT (to evaluate):
"""
${body.output_text}
"""

TRAIT TARGETS:
${traitsList || "(no specific traits — judge overall coherence/readability)"}

${body.expected ? `EXPECTED PATTERNS:\n${body.expected}\n` : ""}
Return your judgement via the emit_score tool.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_score",
              description: "Return per-trait scoring and overall verdict.",
              parameters: {
                type: "object",
                properties: {
                  per_trait: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        trait: { type: "string" },
                        target: { type: "string" },
                        score: { type: "integer", minimum: 1, maximum: 5 },
                        rationale: { type: "string", maxLength: 280 },
                      },
                      required: ["trait", "target", "score", "rationale"],
                      additionalProperties: false,
                    },
                  },
                  overall_score: { type: "number", minimum: 1, maximum: 5 },
                  verdict: { type: "string", enum: ["pass", "fail"] },
                  summary: { type: "string", maxLength: 400 },
                },
                required: ["per_trait", "overall_score", "verdict", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_score" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("judge AI error", aiResp.status, t);
      const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 500;
      const message =
        aiResp.status === 429
          ? "Rate limited — retry shortly"
          : aiResp.status === 402
          ? "AI credits exhausted"
          : `Judge call failed (${aiResp.status})`;
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const argsStr = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) throw new Error("Judge returned no structured output");
    const parsed = JSON.parse(argsStr);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("qa-judge-output error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
