// Posts UGC text content to LinkedIn via the v2 /ugcPosts endpoint.
// Retries up to 7 times with exponential backoff on transient failures.
// Requires LINKEDIN_ACCESS_TOKEN. The Person URN is auto-resolved from
// LinkedIn's /v2/userinfo endpoint using the same token, so users no longer
// need to hand-fetch their Person ID. LINKEDIN_PERSON_URN may still be set
// as an override.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PostBody {
  text: string;
  visibility?: "PUBLIC" | "CONNECTIONS";
  dry_run?: boolean;
}

interface AttemptLog {
  attempt: number;
  status: number;
  ok: boolean;
  error: string | null;
  duration_ms: number;
}

const MAX_ATTEMPTS = 7;
const TRANSIENT_STATUSES = new Set([0, 408, 425, 429, 500, 502, 503, 504]);

// In-memory cache for the resolved Person URN (lives for function lifetime).
let cachedPersonUrn: string | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Resolves the LinkedIn Person URN for the configured access token.
 * Order of precedence:
 *   1. LINKEDIN_PERSON_URN env var (manual override, accepts raw ID or full URN).
 *   2. In-memory cache from a previous resolve.
 *   3. Live call to https://api.linkedin.com/v2/userinfo (OpenID Connect).
 *      Requires the token to include the `openid` + `profile` scopes, which
 *      LinkedIn auto-grants with "Sign In with LinkedIn using OpenID Connect".
 */
async function resolvePersonUrn(accessToken: string): Promise<{ urn: string | null; error: string | null }> {
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
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const text = await resp.text();
    if (!resp.ok) {
      return {
        urn: null,
        error: `userinfo failed [${resp.status}]: ${text.slice(0, 300)}`,
      };
    }
    const json = JSON.parse(text);
    const sub = json?.sub;
    if (!sub || typeof sub !== "string") {
      return { urn: null, error: "userinfo response missing 'sub' field" };
    }
    cachedPersonUrn = `urn:li:person:${sub}`;
    return { urn: cachedPersonUrn, error: null };
  } catch (e) {
    return {
      urn: null,
      error: e instanceof Error ? e.message : "userinfo fetch failed",
    };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LINKEDIN_ACCESS_TOKEN = Deno.env.get("LINKEDIN_ACCESS_TOKEN");
    // LINKEDIN_PERSON_URN is read inside resolvePersonUrn() as an optional override.

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

    const body = (await req.json()) as PostBody;
    if (!body?.text || body.text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.text.length > 3000) {
      return new Response(JSON.stringify({ error: "text exceeds 3000 character LinkedIn limit" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dry-run path: skip LinkedIn entirely.
    if (body.dry_run) {
      return new Response(
        JSON.stringify({
          ok: true,
          dry_run: true,
          message: "Dry run — no LinkedIn API call made.",
          preview_chars: body.text.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!LINKEDIN_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({
          error:
            "LinkedIn credentials not configured. Add the LINKEDIN_ACCESS_TOKEN secret. Person URN is auto-resolved from the token.",
          missing: { access_token: true },
        }),
        { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve the Person URN from the token (or env override). One network call max,
    // then cached for the function's lifetime.
    const { urn: author, error: urnError } = await resolvePersonUrn(LINKEDIN_ACCESS_TOKEN);
    if (!author) {
      return new Response(
        JSON.stringify({
          error:
            "Could not resolve LinkedIn Person URN from access token. Ensure the token includes the 'openid' and 'profile' scopes (Sign In with LinkedIn using OpenID Connect).",
          detail: urnError,
        }),
        { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ugcPayload = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: body.text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": body.visibility ?? "PUBLIC",
      },
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
            Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify(ugcPayload),
        });
        status = resp.status;
        ok = resp.ok;
        const text = await resp.text();
        if (resp.ok) {
          try {
            const j = JSON.parse(text);
            postId = j?.id ?? resp.headers.get("x-restli-id") ?? null;
          } catch {
            postId = resp.headers.get("x-restli-id");
          }
        } else {
          error = text.slice(0, 500);
        }
      } catch (e) {
        error = e instanceof Error ? e.message : "fetch failed";
      }

      const duration_ms = Date.now() - start;
      attempts.push({ attempt, status, ok, error, duration_ms });

      if (ok && postId) {
        return new Response(
          JSON.stringify({
            ok: true,
            post_id: postId,
            post_url: postId
              ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}/`
              : null,
            attempts,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      lastError = error;

      // Don't retry permanent failures.
      if (!TRANSIENT_STATUSES.has(status) && status !== 0) {
        break;
      }

      if (attempt < MAX_ATTEMPTS) {
        const backoff = Math.min(15000, 500 * 2 ** (attempt - 1));
        await sleep(backoff);
      }
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: lastError ?? "All retries exhausted",
        attempts,
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("linkedin-post error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
