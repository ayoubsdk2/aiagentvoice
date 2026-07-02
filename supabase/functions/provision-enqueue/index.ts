// Stripe-triggered enqueue: insert a provisioning_jobs row keyed by the
// Stripe event id (idempotent) and publish it to QStash for the worker.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { publishQStash } from "../_shared/qstash.ts";
import { createLogger } from "../_shared/secure-logger.ts";

const log = createLogger("provision-enqueue");

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const BodySchema = z.object({
  stripe_event_id: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  company_name: z.string().min(1),
  area_code: z.string().regex(/^\d{3}$/).optional(),
  website_url: z.string().url().optional(),
  email_address: z.string().email().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function authorized(req: Request): boolean {
  const tok = req.headers.get("x-service-token");
  const expected = Deno.env.get("SERVICE_API_KEY");
  if (tok && expected && tok === expected) return true;
  // Allow admin HMAC via admin-gate verify
  return false;
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

  const idempotencyKey = parsed.data.stripe_event_id ?? crypto.randomUUID();

  const { data: existing } = await admin
    .from("provisioning_jobs")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ job_id: existing.id, status: existing.status, replayed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: job, error } = await admin.from("provisioning_jobs").insert({
    idempotency_key: idempotencyKey,
    stripe_event_id: parsed.data.stripe_event_id ?? null,
    customer_id: parsed.data.customer_id ?? null,
    status: "queued",
    payload: parsed.data as any,
  }).select("id").single();
  if (error || !job) {
    log.error("insert job failed", { err: error?.message });
    return new Response(JSON.stringify({ error: "insert_failed" }), { status: 500 });
  }

  try {
    const workerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/provision-worker`;
    await publishQStash({
      url: workerUrl,
      body: { job_id: job.id },
      deduplicationId: idempotencyKey,
      retries: 3,
    });
  } catch (err) {
    log.error("qstash publish failed", { err: String(err) });
    // Job stays in 'queued'; admin can re-publish manually if QStash is down.
  }

  return new Response(JSON.stringify({ job_id: job.id, status: "queued" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
