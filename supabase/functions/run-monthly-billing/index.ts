// Monthly billing run — invoked manually or via cron on the 1st of each month.
// Sums the prior month's usage_events per org, creates a Stripe Invoice with
// one line item, and finalizes it (which auto-charges the saved card).
//
// Idempotent via UNIQUE (organization_id, billing_period) on billing_invoices.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  createStripeClient,
  corsHeaders,
} from "../_shared/stripe.ts";
import { notifySlack } from "../_shared/notify.ts";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function priorMonth(d = new Date()): { period: string; label: string } {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // current month 0-indexed
  const prior = new Date(Date.UTC(y, m - 1, 1));
  const period = prior.toISOString().slice(0, 10); // YYYY-MM-01
  const label = prior.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { period, label };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const env: StripeEnv = url.searchParams.get("env") === "live" ? "live" : "sandbox";

    // Optional override for testing: ?period=2026-04-01
    const periodOverride = url.searchParams.get("period");
    const dryRun = url.searchParams.get("dry_run") === "1";

    // Auth: require service-role JWT or admin key in header
    const adminKey = req.headers.get("x-phaos-admin");
    const allowedAdmin = Deno.env.get("PHAOS_BILLING_ADMIN_KEY");
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceRole = serviceKey.length > 0 && authHeader === `Bearer ${serviceKey}`;
    const isAuthorized = (adminKey && allowedAdmin && adminKey === allowedAdmin) || isServiceRole;
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { period, label } = periodOverride
      ? { period: periodOverride, label: periodOverride }
      : priorMonth();

    const stripe = createStripeClient(env);

    // Find orgs with unbilled usage in this period
    const { data: usageRows, error: usageErr } = await supa
      .from("usage_events")
      .select("organization_id, seconds_used, cost_cents")
      .eq("billing_period", period)
      .is("billed_at", null);
    if (usageErr) throw usageErr;

    const byOrg = new Map<string, { seconds: number; cents: number }>();
    for (const r of usageRows ?? []) {
      const cur = byOrg.get(r.organization_id) ?? { seconds: 0, cents: 0 };
      cur.seconds += Number(r.seconds_used);
      cur.cents += Number(r.cost_cents);
      byOrg.set(r.organization_id, cur);
    }

    const results: any[] = [];
    for (const [orgId, totals] of byOrg) {
      const totalCents = Math.round(totals.cents);
      if (totalCents <= 0) continue;

      const { data: org } = await supa
        .from("organizations")
        .select("name, billing_email, stripe_customer_id, stripe_payment_method_id")
        .eq("id", orgId)
        .maybeSingle();
      if (!org?.stripe_customer_id) {
        results.push({ orgId, skipped: "no stripe customer" });
        continue;
      }

      // Idempotency: check if invoice already exists for period
      const { data: existing } = await supa
        .from("billing_invoices")
        .select("id, status, stripe_invoice_id")
        .eq("organization_id", orgId)
        .eq("billing_period", period)
        .maybeSingle();
      if (existing && existing.status !== "pending") {
        results.push({ orgId, skipped: "already invoiced", status: existing.status });
        continue;
      }

      if (dryRun) {
        results.push({ orgId, dry: true, totalSeconds: totals.seconds, totalCents });
        continue;
      }

      // Create invoice item
      await stripe.invoiceItems.create({
        customer: org.stripe_customer_id,
        amount: totalCents,
        currency: "usd",
        description: `Phaos AI — ${label} usage (${totals.seconds} seconds @ $0.20/min)`,
        metadata: { organization_id: orgId, billing_period: period },
      });

      // Create + auto-finalize invoice (Stripe will charge the default PM)
      const invoice = await stripe.invoices.create({
        customer: org.stripe_customer_id,
        collection_method: "charge_automatically",
        auto_advance: true,
        description: `Voice usage — ${label}`,
        metadata: { organization_id: orgId, billing_period: period },
      });

      const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

      // Persist
      const { data: invRow } = await supa
        .from("billing_invoices")
        .upsert(
          {
            organization_id: orgId,
            billing_period: period,
            stripe_invoice_id: finalized.id,
            total_seconds: totals.seconds,
            total_cents: totalCents,
            status: "sent",
            finalized_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,billing_period" },
        )
        .select("id")
        .single();

      // Mark usage as billed
      if (invRow) {
        await supa
          .from("usage_events")
          .update({ billed_at: new Date().toISOString(), invoice_id: invRow.id })
          .eq("organization_id", orgId)
          .eq("billing_period", period)
          .is("billed_at", null);
      }

      results.push({
        orgId,
        invoiced: true,
        totalSeconds: totals.seconds,
        totalCents,
        stripeInvoiceId: finalized.id,
      });
    }

    await notifySlack(
      `:money_with_wings: Monthly billing run for *${label}* (${env}): ${results.filter((r) => r.invoiced).length} invoices created, total $${results.reduce((a, r) => a + (r.invoiced ? r.totalCents : 0), 0) / 100}`,
    );

    return new Response(
      JSON.stringify({ ok: true, period, env, dryRun, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[run-monthly-billing]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
