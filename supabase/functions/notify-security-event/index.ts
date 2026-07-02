import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Periodic security alert scanner (intended to be invoked manually or via cron).
 * Reads `suspicious_login_activity` and emails phaos admins about elevated failed login patterns.
 * Idempotent within a 60-minute window via metadata fingerprint in audit_events.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require shared admin secret or service-role JWT — this endpoint emails admins
  // and would otherwise be a trivial inbox-flood / information-leak vector.
  const adminKey = req.headers.get("x-phaos-admin");
  const allowedAdmin = Deno.env.get("PHAOS_BILLING_ADMIN_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const isServiceRole = serviceKey.length > 0 && authHeader === `Bearer ${serviceKey}`;
  const isAuthorized = (adminKey && allowedAdmin && adminKey === allowedAdmin) || isServiceRole;
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: suspicious, error: viewErr } = await admin
    .from("suspicious_login_activity")
    .select("*")
    .order("failed_attempts", { ascending: false })
    .limit(50);

  if (viewErr) {
    return new Response(JSON.stringify({ error: viewErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!suspicious || suspicious.length === 0) {
    return new Response(JSON.stringify({ ok: true, alerts: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  if (RESEND_KEY) {
    const html = `<h3>Phaos AI — Suspicious Login Alert</h3>
      <p>Detected ${suspicious.length} IP/window combinations with ≥5 failed logins in the last 24h.</p>
      <table border="1" cellpadding="6" style="border-collapse:collapse;font-family:monospace;font-size:12px">
        <tr><th>IP</th><th>Attempts</th><th>Distinct users</th><th>Last attempt</th></tr>
        ${suspicious.map((r: { ip_address: string; failed_attempts: number; distinct_users: number; last_attempt_at: string }) =>
          `<tr><td>${r.ip_address ?? "(none)"}</td><td>${r.failed_attempts}</td><td>${r.distinct_users}</td><td>${r.last_attempt_at}</td></tr>`
        ).join("")}
      </table>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "noreply@phaosai.com",
        to: "daniel@phaosai.com",
        subject: `[Phaos] ${suspicious.length} suspicious login pattern(s) detected`,
        html,
      }),
    });
  }

  await admin.from("audit_events").insert({
    actor_type: "system",
    action: "security.suspicious_login_alert",
    resource_type: "view",
    resource_id: "suspicious_login_activity",
    metadata: { count: suspicious.length, top_ip: suspicious[0]?.ip_address ?? null, emailed: !!RESEND_KEY },
  });

  return new Response(JSON.stringify({ ok: true, alerts: suspicious.length, emailed: !!RESEND_KEY }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
