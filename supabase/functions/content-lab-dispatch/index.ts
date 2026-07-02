// Dispatcher: scans content_queue for due "scheduled" posts, POSTs the row to the
// admin's Make.com webhook, then marks them "published" (or reverts to "draft" + records error).
// Triggered every minute by pg_cron, and can be triggered manually by the admin from the UI.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_EMAIL = "daniel@phaosai.com";
const MAX_BATCH = 25;
const DELIVERY_TIMEOUT_MS = 15_000;

type QueueRow = {
  id: string;
  title: string;
  scheduled_at: string | null;
  category: string;
  status: string;
  blog_body: string | null;
  linkedin_hook: string | null;
  facebook_body: string | null;
  image_url: string | null;
  seo_metadata: Record<string, unknown> | null;
  platform_targets: Record<string, unknown> | null;
  post_type: string;
  created_at: string;
};

async function deliverOne(
  webhookUrl: string,
  row: QueueRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "content_lab.dispatch",
        title: row.title,
        image_url: row.image_url ?? "",
        linkedin_hook: row.linkedin_hook ?? "",
        blog_body: row.blog_body ?? "",
        delivered_at: new Date().toISOString(),
        message: `Content Lab dispatch for "${row.title}" scheduled at ${row.scheduled_at}`,
      }),
      signal: controller.signal,
    });
    const text = await resp.text().catch(() => "");
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "delivery failed";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ---- Auth: cron OR admin user ----
    const cronHeader = req.headers.get("x-cron-secret") ?? "";
    const expectedCron = Deno.env.get("CRON_SECRET") ?? "";
    const isCron = expectedCron.length > 0 && cronHeader === expectedCron;

    let isAdmin = false;
    if (!isCron) {
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
      const { data: isAdminRpc } = await userClient.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "phaos_admin",
      });
      if (isAdminRpc !== true) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      isAdmin = true;
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ---- Load webhook URL (singleton-ish; pick the most recent row) ----
    const { data: settingsRows, error: settingsErr } = await admin
      .from("content_lab_settings")
      .select("id, webhook_url")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (settingsErr) throw settingsErr;
    const webhookUrl = settingsRows?.[0]?.webhook_url?.trim() ?? "";

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({
          delivered: 0,
          failed: 0,
          skipped_reason: "no_webhook_url",
          triggered_by: isCron ? "cron" : "admin",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Find due posts ----
    const nowIso = new Date().toISOString();
    const { data: due, error: dueErr } = await admin
      .from("content_queue")
      .select(
        "id, title, scheduled_at, category, status, blog_body, linkedin_hook, facebook_body, image_url, seo_metadata, platform_targets, post_type, created_at",
      )
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(MAX_BATCH);
    if (dueErr) throw dueErr;

    let delivered = 0;
    let failed = 0;
    const results: Array<{ id: string; status: "published" | "draft"; error?: string }> = [];

    for (const row of (due ?? []) as QueueRow[]) {
      const result = await deliverOne(webhookUrl, row);
      const attemptAt = new Date().toISOString();

      if (result.ok) {
        const { error: updErr } = await admin
          .from("content_queue")
          .update({
            status: "published",
            published_at: attemptAt,
            last_attempt_at: attemptAt,
            last_error: null,
          })
          .eq("id", row.id)
          .eq("status", "scheduled"); // guard against races
        if (updErr) {
          failed++;
          results.push({ id: row.id, status: "draft", error: `mark_published_failed: ${updErr.message}` });
        } else {
          delivered++;
          results.push({ id: row.id, status: "published" });
        }
      } else {
        // Revert to draft + record error + log audit event for admin notification
        await admin
          .from("content_queue")
          .update({
            status: "draft",
            last_attempt_at: attemptAt,
            last_error: result.error,
          })
          .eq("id", row.id)
          .eq("status", "scheduled");
        await admin.from("audit_events").insert({
          actor_type: "system",
          action: "content_lab.delivery_failed",
          resource_type: "content_queue",
          resource_id: row.id,
          metadata: { title: row.title, error: result.error, attempt_at: attemptAt },
        });
        failed++;
        results.push({ id: row.id, status: "draft", error: result.error });
      }
    }

    return new Response(
      JSON.stringify({
        delivered,
        failed,
        scanned: due?.length ?? 0,
        triggered_by: isCron ? "cron" : "admin",
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("content-lab-dispatch error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
