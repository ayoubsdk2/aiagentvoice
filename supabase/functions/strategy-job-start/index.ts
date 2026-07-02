// Creates a strategy_jobs row and fire-and-forgets the first step worker.
// Returns immediately (<500ms target) with { jobId }.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_EMAIL = "daniel@phaosai.com";

// Snap to the Monday of the week that contains `d`. The strategy worker
// computes per-post dates as Monday + day_of_week, and a separate guard in
// the worker ensures the very first post never lands on (or before) the
// generation day — see clampFirstPostDay in strategy-job-step.
function snapToMonday(d: Date): Date {
  const out = new Date(d);
  const dow = (out.getDay() + 6) % 7; // 0=Mon
  out.setDate(out.getDate() - dow);
  out.setHours(10, 0, 0, 0);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SERVICE_API_KEY = Deno.env.get("SERVICE_API_KEY") ?? "";

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

    const body = await req.json().catch(() => ({}));
    const startDateStr = typeof body?.start_date === "string" ? body.start_date : null;
    const resumeJobId = typeof body?.resume_job_id === "string" ? body.resume_job_id : null;
    // Debug-only fail injection (admin-gated above). Forwarded to step worker.
    const failAtStep =
      typeof body?.fail_at_step === "number" && Number.isFinite(body.fail_at_step)
        ? Math.floor(body.fail_at_step)
        : null;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resume path: re-trigger an existing failed/in_progress job from completed_steps.
    if (resumeJobId) {
      const { data: existing, error: fetchErr } = await admin
        .from("strategy_jobs")
        .select("id, user_id, status, completed_steps, total_steps")
        .eq("id", resumeJobId)
        .maybeSingle();
      if (fetchErr || !existing) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing.user_id !== userData.user.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing.completed_steps >= existing.total_steps) {
        return new Response(JSON.stringify({ jobId: resumeJobId, alreadyComplete: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin
        .from("strategy_jobs")
        .update({ status: "queued", error_message: null })
        .eq("id", resumeJobId);

      // Fire-and-forget the next step.
      const resumeBody: Record<string, unknown> = { job_id: resumeJobId };
      if (failAtStep !== null) resumeBody.fail_at_step = failAtStep;
      void fetch(`${SUPABASE_URL}/functions/v1/strategy-job-step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "x-service-token": SERVICE_API_KEY,
        },
        body: JSON.stringify(resumeBody),
      }).catch((e) => console.error("step kickoff (resume) failed", e));

      return new Response(JSON.stringify({ jobId: resumeJobId, resumed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fresh job
    const startDate = startDateStr ? new Date(startDateStr) : new Date();
    if (isNaN(startDate.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid start_date" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const monday = snapToMonday(startDate);

    const { data: inserted, error: insErr } = await admin
      .from("strategy_jobs")
      .insert({
        user_id: userData.user.id,
        status: "queued",
        total_steps: 4,
        completed_steps: 0,
        current_step: "week_1",
        start_date: monday.toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      console.error("strategy_jobs insert failed", insErr);
      return new Response(JSON.stringify({ error: insErr?.message ?? "Insert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire-and-forget the first step worker (do NOT await — keeps this response fast).
    const firstBody: Record<string, unknown> = { job_id: inserted.id };
    if (failAtStep !== null) firstBody.fail_at_step = failAtStep;
    void fetch(`${SUPABASE_URL}/functions/v1/strategy-job-step`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-service-token": SERVICE_API_KEY,
      },
      body: JSON.stringify(firstBody),
    }).catch((e) => console.error("step kickoff failed", e));

    return new Response(JSON.stringify({ jobId: inserted.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("strategy-job-start error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
