// Retell webhook receiver. Verifies signature, validates payloads, and
// proxies tool calls to the Render Action Router with the configured
// shared secret. Wraps everything in a Langfuse trace.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyRetell } from "../_shared/verify-signatures.ts";
import { createLogger } from "../_shared/secure-logger.ts";
import { startTrace } from "../_shared/langfuse.ts";

const log = createLogger("retell-webhook");

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const EventSchema = z.object({
  event: z.enum(["call_started", "call_ended", "call_analyzed", "tool_call"]),
  call: z.object({
    call_id: z.string(),
    agent_id: z.string().optional(),
    from_number: z.string().optional(),
    to_number: z.string().optional(),
    transcript: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).passthrough(),
  tool_call: z.object({
    name: z.string(),
    arguments: z.record(z.unknown()).optional(),
    tool_call_id: z.string().optional(),
  }).optional(),
}).passthrough();

async function forwardToActionRouter(toolName: string, args: unknown, ctx: unknown) {
  const url = Deno.env.get("RENDER_ACTION_ROUTER_URL");
  const secret = Deno.env.get("RENDER_ACTION_ROUTER_SECRET");
  if (!url || !secret) throw new Error("action_router_not_configured");
  const res = await fetch(url.replace(/\/$/, "") + `/tools/${encodeURIComponent(toolName)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Action-Router-Secret": secret,
    },
    body: JSON.stringify({ args, context: ctx }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`action_router_${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  let event: any;
  try {
    const verified = await verifyRetell(req);
    event = verified.event;
  } catch (err) {
    log.warn("verify failed", { err: String(err) });
    return new Response("invalid signature", { status: 401 });
  }

  const parsed = EventSchema.safeParse(event);
  if (!parsed.success) {
    log.warn("invalid event shape", { issues: parsed.error.flatten() });
    return new Response("invalid event", { status: 422 });
  }
  const { event: type, call, tool_call } = parsed.data;
  const trace = startTrace(`retell.${type}`, { call_id: call.call_id, agent_id: call.agent_id });

  try {
    if (type === "tool_call" && tool_call) {
      const span = trace.span(`tool.${tool_call.name}`, tool_call.arguments);
      const result = await forwardToActionRouter(tool_call.name, tool_call.arguments ?? {}, {
        call_id: call.call_id,
        agent_id: call.agent_id,
        from_number: call.from_number,
        metadata: call.metadata,
      });
      await span.end(result);
      await trace.end(result);
      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "call_ended" || type === "call_analyzed") {
      // Best-effort transcript persistence; never block ack.
      try {
        let orgId = null;
        if (call.agent_id) {
          const { data: agentData, error: agentErr } = await admin
            .from("retell_agents")
            .select("org_id")
            .eq("retell_agent_id", call.agent_id)
            .single();
          
          if (agentErr) {
            log.warn("failed to lookup agent org_id", { err: agentErr.message });
          } else if (agentData) {
            orgId = agentData.org_id;
          }
        }

        if (orgId) {
          const { error: insertErr } = await admin.from("portal_calls").insert({
            org_id: orgId,
            // Note: portal_calls schema requires location_id and phone_number_id.
            // If they are NOT NULL in DB, this insert will fail without them.
            caller_phone: call.from_number,
            metadata: call as any,
          } as any);
          if (insertErr) throw new Error(`portal_calls insert error: ${insertErr.message}`);
        } else {
          log.warn("no org_id found for agent, falling back to legacy calls table", { agent_id: call.agent_id });
          await admin.from("calls").insert({
            vapi_call_id: call.call_id,
            provider: "retell",
            transcript_url: null,
            metadata: call as any,
          } as any);
        }
      } catch (err) {
        log.warn("transcript persist failed", { err: String(err) });
      }
    }

    await trace.end({ ok: true });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log.error("handler error", { err: String(err) });
    await trace.end({ error: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
