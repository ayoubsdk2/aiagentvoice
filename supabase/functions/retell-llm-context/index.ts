// Runtime retrieval endpoint: embeds a query and returns top-K knowledge
// chunks for the caller's tenant. Designed to be called by the Retell
// agent (via Action Router) during a live call.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { embedOne } from "../_shared/embeddings.ts";
import { createLogger } from "../_shared/secure-logger.ts";

const log = createLogger("retell-llm-context");

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const BodySchema = z.object({
  customer_id: z.string().uuid(),
  query: z.string().min(1).max(2000),
  k: z.number().int().min(1).max(20).optional(),
  caller_phone: z.string().max(40).optional(),
  caller_email: z.string().max(255).optional(),
});

function authorized(req: Request): boolean {
  const secret = Deno.env.get("RENDER_ACTION_ROUTER_SECRET");
  return !!secret && req.headers.get("x-action-router-secret") === secret;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400 });
  }

  try {
    const embedding = await embedOne(parsed.data.query);
    const [{ data: matches, error: matchErr }, leadRes, customerRes] = await Promise.all([
      admin.rpc("match_knowledge", {
        _customer_id: parsed.data.customer_id,
        _query_embedding: embedding as any,
        _k: parsed.data.k ?? 5,
      }),
      // Best-effort CRM lookup by phone/email within tenant.
      (parsed.data.caller_phone || parsed.data.caller_email)
        ? admin
            .from("orchestrator_leads")
            .select("id, contact_name, email, phone, status, last_intent, notes, updated_at")
            .eq("customer_id", parsed.data.customer_id)
            .or(
              [
                parsed.data.caller_phone ? `phone.eq.${parsed.data.caller_phone}` : null,
                parsed.data.caller_email ? `email.eq.${parsed.data.caller_email}` : null,
              ].filter(Boolean).join(","),
            )
            .order("updated_at", { ascending: false })
            .limit(3)
        : Promise.resolve({ data: null, error: null } as any),
      admin.from("customers").select("name").eq("id", parsed.data.customer_id).maybeSingle(),
    ]);
    if (matchErr) throw new Error(matchErr.message);
    return new Response(
      JSON.stringify({
        customer: customerRes.data ?? null,
        matches: matches ?? [],
        crm: leadRes?.data ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    log.error("retrieval failed", { err: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
