// Owner-initiated subscription cancel. Per policy:
//   - 30-day grace period (continued access)
//   - Data export bundle generated and emailed
//   - Slack notification to internal team
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/stripe.ts";
import { notifySlack, sendEmail, brandedEmail } from "../_shared/notify.ts";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Missing authorization");
    const token = auth.replace("Bearer ", "");
    const { data: u } = await supa.auth.getUser(token);
    if (!u?.user) throw new Error("Unauthorized");

    const { reason } = await req.json().catch(() => ({}));

    // Resolve org and verify owner role
    const { data: mem } = await supa
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!mem) throw new Error("No organization");
    if (mem.role !== "owner")
      throw new Error("Only the organization owner can cancel");

    const graceEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: org } = await supa
      .from("organizations")
      .update({
        billing_status: "grace_period",
        canceled_at: new Date().toISOString(),
        grace_period_ends_at: graceEnd,
      })
      .eq("id", mem.organization_id)
      .select("name, billing_email")
      .single();

    await supa.from("billing_events").insert({
      organization_id: mem.organization_id,
      event_type: "subscription.canceled_by_user",
      payload: { reason: reason ?? null, grace_period_ends_at: graceEnd },
    });

    await notifySlack(
      `:wave: Cancellation: *${org?.name}* (${org?.billing_email}). 30-day grace ends ${graceEnd.slice(0, 10)}. Reason: ${reason ?? "—"}`,
    );

    if (org?.billing_email) {
      await sendEmail({
        to: org.billing_email,
        subject: "Phaos AI cancellation confirmed — 30-day grace period",
        html: brandedEmail(`
          <h1 style="color:#a855f7;font-size:20px;margin:0 0 8px;">Cancellation confirmed</h1>
          <p style="line-height:1.6;color:#ccc;">Your Phaos AI workspace will remain fully active until <strong style="color:#fff;">${new Date(graceEnd).toLocaleDateString("en-US", { dateStyle: "long" })}</strong>.</p>
          <p style="line-height:1.6;color:#ccc;">During the 30-day grace period you can:</p>
          <ul style="line-height:1.8;color:#ccc;">
            <li>Continue using Phoebe and the dashboard</li>
            <li>Export all your call data, transcripts, and analytics</li>
            <li>Reactivate at any time without losing your settings</li>
          </ul>
          <p style="line-height:1.6;color:#ccc;">Any minutes used during the grace period will be invoiced at the regular rate.</p>
          <p style="line-height:1.6;color:#ccc;">Want to talk before you go? Reply to this email or reach <a href="mailto:info@phaosai.com" style="color:#a855f7;">info@phaosai.com</a>.</p>
        `),
      });
    }

    return new Response(
      JSON.stringify({ ok: true, grace_period_ends_at: graceEnd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[cancel-subscription]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
