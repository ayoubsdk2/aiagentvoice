// Publishes a single content_queue row (or arbitrary text) to LinkedIn IMMEDIATELY.
// Used by:
//   1. The "LinkedIn Proof Post" button — sends a short, one-shot test post
//      so the admin can see end-to-end publishing actually works.
//   2. The "Publish Now" / "Retry" calendar buttons — picks up an existing
//      queue row, posts its linkedin_hook, and writes published_at + post URL
//      (or last_error) back to the row.
//
// Mirrors the retry/backoff logic of `linkedin-post` but is row-aware.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { validateScheduledPost, type QueueLikeRow } from "../_shared/content-scheduler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_EMAIL = "daniel@phaosai.com";
const MAX_ATTEMPTS = 5;
const TRANSIENT_STATUSES = new Set([0, 408, 425, 429, 500, 502, 503, 504]);

interface RequestBody {
  // Either supply a queue row id...
  queue_row_id?: string;
  // ...or post arbitrary text directly (used by the proof button).
  text?: string;
  visibility?: "PUBLIC" | "CONNECTIONS";
  // When true, do not write back to content_queue.
  proof_mode?: boolean;
}

interface AttemptLog {
  attempt: number;
  status: number;
  ok: boolean;
  error: string | null;
  duration_ms: number;
}

let cachedPersonUrn: string | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolvePersonUrn(token: string): Promise<{ urn: string | null; error: string | null }> {
  const override = Deno.env.get("LINKEDIN_PERSON_URN");
  if (override && override.trim().length > 0) {
    return {
      urn: override.startsWith("urn:li:person:") ? override : `urn:li:person:${override}`,
      error: null,
    };
  }
  if (cachedPersonUrn) return { urn: cachedPersonUrn, error: null };

  try {
    const resp = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await resp.text();
    if (!resp.ok) {
      return { urn: null, error: `userinfo failed [${resp.status}]: ${text.slice(0, 300)}` };
    }
    const json = JSON.parse(text);
    if (!json?.sub || typeof json.sub !== "string") {
      return { urn: null, error: "userinfo missing 'sub' field" };
    }
    cachedPersonUrn = `urn:li:person:${json.sub}`;
    return { urn: cachedPersonUrn, error: null };
  } catch (e) {
    return { urn: null, error: e instanceof Error ? e.message : "userinfo fetch failed" };
  }
}

interface PublishResult {
  ok: boolean;
  postId: string | null;
  postUrl: string | null;
  error: string | null;
  attempts: AttemptLog[];
}

async function publishToLinkedIn(token: string, author: string, text: string, visibility: "PUBLIC" | "CONNECTIONS"): Promise<PublishResult> {
  const payload = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": visibility },
  };

  const attempts: AttemptLog[] = [];
  let postId: string | null = null;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const start = Date.now();
    let status = 0;
    let ok = false;
    let error: string | null = null;
    try {
      const resp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(payload),
      });
      status = resp.status;
      ok = resp.ok;
      const body = await resp.text();
      if (resp.ok) {
        try {
          const j = JSON.parse(body);
          postId = j?.id ?? resp.headers.get("x-restli-id") ?? null;
        } catch {
          postId = resp.headers.get("x-restli-id");
        }
      } else {
        error = body.slice(0, 500);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "fetch failed";
    }

    attempts.push({ attempt, status, ok, error, duration_ms: Date.now() - start });

    if (ok && postId) {
      return {
        ok: true,
        postId,
        postUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}/`,
        error: null,
        attempts,
      };
    }

    lastError = error;
    if (!TRANSIENT_STATUSES.has(status) && status !== 0) break;
    if (attempt < MAX_ATTEMPTS) await sleep(Math.min(8000, 500 * 2 ** (attempt - 1)));
  }

  return { ok: false, postId: null, postUrl: null, error: lastError ?? "All retries exhausted", attempts };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LINKEDIN_TOKEN = Deno.env.get("LINKEDIN_ACCESS_TOKEN");

    // --- Auth: admin only ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: u.user.id,
      _role: "phaos_admin",
    });
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LINKEDIN_TOKEN) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "LINKEDIN_ACCESS_TOKEN secret is not configured.",
          stage: "credentials",
        }),
        { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as RequestBody;
    const visibility: "PUBLIC" | "CONNECTIONS" = body.visibility === "CONNECTIONS" ? "CONNECTIONS" : "PUBLIC";

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Resolve text + (optional) row to update ---
    let text = body.text?.trim() ?? "";
    let rowId: string | null = body.queue_row_id ?? null;

    if (rowId && !body.proof_mode) {
      const { data: row, error: rowErr } = await admin
        .from("content_queue")
        .select("id, title, linkedin_hook, facebook_body, blog_body, image_url, status, scheduled_at, category, platform_targets, seo_metadata")
        .eq("id", rowId)
        .maybeSingle();
      if (rowErr || !row) {
        return new Response(
          JSON.stringify({ ok: false, error: "Queue row not found.", stage: "lookup" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      text = (row.linkedin_hook ?? "").trim();
      if (!text) {
        return new Response(
          JSON.stringify({ ok: false, error: "Row has no LinkedIn copy to publish.", stage: "validation" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // --- NON-NEGOTIABLE server-side slot validation ---
      // Pull other LinkedIn rows in the same week so gap rules are enforced server-side
      // even if the client tries to bypass them.
      const scheduledAt = row.scheduled_at ? new Date(row.scheduled_at) : null;
      let neighbors: QueueLikeRow[] = [];
      if (scheduledAt) {
        const windowStart = new Date(scheduledAt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const windowEnd = new Date(scheduledAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: others } = await admin
          .from("content_queue")
          .select("id, scheduled_at, status, category, linkedin_hook, facebook_body, blog_body, image_url, platform_targets, seo_metadata")
          .gte("scheduled_at", windowStart)
          .lte("scheduled_at", windowEnd)
          .neq("id", rowId);
        neighbors = (others ?? []) as QueueLikeRow[];
      }

      const validation = validateScheduledPost(row as QueueLikeRow, neighbors);
      if (!validation.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Slot validation failed — non-negotiable rules blocked this post.",
            stage: "slot_validation",
            issues: validation.issues,
            slot: validation.slot,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!text) {
      return new Response(
        JSON.stringify({ ok: false, error: "Text is required.", stage: "validation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (text.length > 3000) {
      return new Response(
        JSON.stringify({ ok: false, error: "Text exceeds the 3,000-character LinkedIn limit.", stage: "validation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Resolve author URN ---
    const { urn, error: urnError } = await resolvePersonUrn(LINKEDIN_TOKEN);
    if (!urn) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Could not resolve LinkedIn Person URN. Token must include the 'openid' + 'profile' scopes.",
          detail: urnError,
          stage: "author",
        }),
        { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Publish ---
    const result = await publishToLinkedIn(LINKEDIN_TOKEN, urn, text, visibility);
    const nowIso = new Date().toISOString();

    // --- Write-back when tied to a queue row ---
    if (rowId && !body.proof_mode) {
      if (result.ok) {
        await admin
          .from("content_queue")
          .update({
            status: "published",
            published_at: nowIso,
            last_attempt_at: nowIso,
            last_error: null,
            seo_metadata: { delivery: { post_url: result.postUrl, post_id: result.postId, channel: "linkedin", at: nowIso } },
          })
          .eq("id", rowId);
      } else {
        await admin
          .from("content_queue")
          .update({
            status: "draft",
            last_attempt_at: nowIso,
            last_error: result.error,
          })
          .eq("id", rowId);
      }
      await admin.from("audit_events").insert({
        actor_user_id: u.user.id,
        actor_type: "user",
        action: result.ok ? "content_lab.linkedin_published" : "content_lab.linkedin_failed",
        resource_type: "content_queue",
        resource_id: rowId,
        metadata: {
          post_url: result.postUrl,
          error: result.error,
          attempts: result.attempts.length,
        },
      });
    }

    return new Response(
      JSON.stringify({
        ok: result.ok,
        post_id: result.postId,
        post_url: result.postUrl,
        error: result.error,
        attempts: result.attempts,
        stage: result.ok ? "published" : "publish_failed",
        proof_mode: !!body.proof_mode,
      }),
      {
        status: result.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("linkedin-publish-now error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message, stage: "exception" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
