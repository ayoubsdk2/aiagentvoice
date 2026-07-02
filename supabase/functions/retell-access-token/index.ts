// Mint a short-lived Retell WebRTC access token for the browser sandbox.
// Public, no auth required (the agent itself is the trust boundary).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { createWebCall } from "../_shared/retell-api.ts";
import { createLogger } from "../_shared/secure-logger.ts";
import { withTrace } from "../_shared/langfuse.ts";

const log = createLogger("retell-access-token");

const BodySchema = z.object({
  agent_id: z.string().min(8),
  metadata: z.record(z.unknown()).optional(),
  retell_llm_dynamic_variables: z.record(z.string()).optional(),
  agent_override: z.record(z.unknown()).optional(),
});


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid_payload", issues: parsed.error.flatten() }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // If caller overrides the voice, also clear fallback voices — Retell
    // rejects calls when main + fallback share a provider. Accept both
    // shapes: flat `{ voice_id }` (current client) and legacy nested
    // `{ agent: { voice_id } }`.
    let agentOverride = parsed.data.agent_override as Record<string, unknown> | undefined;
    if (agentOverride && typeof agentOverride === "object") {
      if (typeof (agentOverride as { voice_id?: unknown }).voice_id === "string") {
        agentOverride = { ...agentOverride, fallback_voice_ids: [] };
      } else {
        const inner = (agentOverride as { agent?: Record<string, unknown> }).agent;
        if (inner && typeof inner === "object" && typeof inner.voice_id === "string") {
          agentOverride = {
            ...agentOverride,
            agent: { ...inner, fallback_voice_ids: [] },
          };
        }
      }
    }

    const result = await withTrace("retell.create_web_call", async (trace) => {
      const span = trace.span("retell.api", { agent_id: parsed.data.agent_id });
      const call = await createWebCall(
        parsed.data.agent_id,
        parsed.data.metadata,
        parsed.data.retell_llm_dynamic_variables,
        agentOverride ? { agent_override: agentOverride } : undefined,
      );
      await span.end({ call_id: call.call_id });
      return call;
    }, { agent_id: parsed.data.agent_id });



    return new Response(
      JSON.stringify({
        access_token: result.access_token,
        call_id: result.call_id,
        sample_rate: result.sample_rate ?? 24000,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    log.error("create_web_call failed", { err: String(err) });
    return new Response(JSON.stringify({ error: "retell_error", detail: String(err) }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
