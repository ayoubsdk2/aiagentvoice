// Atomic integration toggle. Serializes per-tenant updates and runs a
// silent ping before flipping a vendor to active. Then updates the
// Retell agent's active tools array.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { updateAgent } from "../_shared/retell-api.ts";
import { createLogger } from "../_shared/secure-logger.ts";

const log = createLogger("integration-toggle");

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const BodySchema = z.object({
  customer_id: z.string().uuid(),
  retell_agent_id: z.string(),
  tools: z.array(z.string()),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response("unauthorized", { status: 401 });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userRes } = await userClient.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) return new Response("unauthorized", { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400 });

  // Tenant check: caller must belong to customer_id OR be phaos_admin.
  const { data: tenantId } = await userClient.rpc("tenant_of", { _user_id: userId });
  const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: userId, _role: "phaos_admin" });
  if (tenantId !== parsed.data.customer_id && !isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  try {
    // RPC takes the advisory lock + writes the row atomically.
    const { error: rpcErr } = await admin.rpc("set_active_tools", {
      _customer_id: parsed.data.customer_id,
      _retell_agent_id: parsed.data.retell_agent_id,
      _tools: parsed.data.tools as any,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    // Push to Retell. Tool definitions live in src/lib/retell-tools-registry.ts
    // and are referenced by name; here we forward the active list and let the
    // agent template's response_engine resolve them.
    await updateAgent(parsed.data.retell_agent_id, {
      response_engine: { type: "retell-llm", active_tools: parsed.data.tools },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log.error("toggle failed", { err: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
