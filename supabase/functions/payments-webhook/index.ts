// Webhook handler for Stripe events. Updates organizations.billing_status,
// records payment success/failure on billing_invoices, and notifies Slack.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  verifyWebhook,
  createStripeClient,
} from "../_shared/stripe.ts";
import { notifySlack, sendEmail, brandedEmail } from "../_shared/notify.ts";

let _supa: ReturnType<typeof createClient> | null = null;
function supa() {
  if (!_supa) {
    _supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supa;
}

async function logEvent(orgId: string | null, type: string, eventId: string, payload: any) {
  await supa().from("billing_events").insert({
    organization_id: orgId,
    event_type: type,
    stripe_event_id: eventId,
    payload,
  });
}

async function findOrgByStripeCustomerId(customerId: string): Promise<string | null> {
  const { data } = await supa()
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

async function handleSetupIntentSucceeded(intent: any, env: StripeEnv) {
  const orgId = intent.metadata?.organization_id ||
    (await findOrgByStripeCustomerId(intent.customer));
  if (!orgId) return;

  const stripe = createStripeClient(env);
  const pm = await stripe.paymentMethods.retrieve(intent.payment_method);

  // Set as default payment method on the customer
  await stripe.customers.update(intent.customer, {
    invoice_settings: { default_payment_method: pm.id },
  });

  await supa()
    .from("organizations")
    .update({
      stripe_payment_method_id: pm.id,
      stripe_payment_method_verified: true,
      card_brand: pm.card?.brand ?? null,
      card_last4: pm.card?.last4 ?? null,
      card_exp_month: pm.card?.exp_month ?? null,
      card_exp_year: pm.card?.exp_year ?? null,
      billing_status: "active",
    })
    .eq("id", orgId);

  const { data: org } = await supa()
    .from("organizations")
    .select("name, billing_email")
    .eq("id", orgId)
    .maybeSingle();

  await notifySlack(
    `:tada: New VIP Early Adopter activated: *${org?.name ?? orgId}* (${org?.billing_email ?? "no email"}). Card on file: ${pm.card?.brand} ****${pm.card?.last4}.`,
  );

  if (org?.billing_email) {
    await sendEmail({
      to: org.billing_email,
      subject: "Welcome to Phaos AI — your workspace is active",
      html: brandedEmail(`
        <h1 style="color:#a855f7;font-size:22px;margin:0 0 8px;">Welcome to Phaos AI</h1>
        <p style="line-height:1.6;color:#ccc;">Your VIP Early Adopter account is fully activated.</p>
        <div style="background:#141414;border:1px solid #222;border-radius:12px;padding:16px;margin:16px 0;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px;">Your plan</div>
          <div style="font-weight:700;font-size:16px;color:#fff;">VIP Early Adopter</div>
          <div style="color:#a855f7;font-size:14px;margin-top:4px;">$0 setup · $0 monthly · $0.20/min usage</div>
        </div>
        <p style="line-height:1.6;color:#ccc;">Card on file: ${pm.card?.brand?.toUpperCase()} ending in ${pm.card?.last4}. We'll invoice you monthly for any voice minutes used.</p>
        <p style="line-height:1.6;color:#ccc;">Questions? Reply to this email or contact <a href="mailto:info@phaosai.com" style="color:#a855f7;">info@phaosai.com</a>.</p>
      `),
    });
  }
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  const orgId = await findOrgByStripeCustomerId(invoice.customer);
  if (!orgId) return;

  await supa()
    .from("billing_invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: invoice.payment_intent ?? null,
    })
    .eq("stripe_invoice_id", invoice.id);

  await supa()
    .from("organizations")
    .update({ billing_status: "active" })
    .eq("id", orgId);

  await notifySlack(
    `:moneybag: Invoice paid: *$${(invoice.amount_paid / 100).toFixed(2)}* — org ${orgId}`,
  );
}

async function handleInvoicePaymentFailed(invoice: any) {
  const orgId = await findOrgByStripeCustomerId(invoice.customer);
  if (!orgId) return;

  await supa()
    .from("billing_invoices")
    .update({
      status: "failed",
      attempt_count: (invoice.attempt_count ?? 0),
      last_error: invoice.last_finalization_error?.message ?? "Payment failed",
    })
    .eq("stripe_invoice_id", invoice.id);

  await supa()
    .from("organizations")
    .update({ billing_status: "past_due" })
    .eq("id", orgId);

  const { data: org } = await supa()
    .from("organizations")
    .select("name, billing_email")
    .eq("id", orgId)
    .maybeSingle();

  await notifySlack(
    `:warning: Payment failed: *${org?.name ?? orgId}* — $${(invoice.amount_due / 100).toFixed(2)}`,
  );

  if (org?.billing_email) {
    await sendEmail({
      to: org.billing_email,
      subject: "Action needed: payment failed for your Phaos AI invoice",
      html: brandedEmail(`
        <h1 style="color:#eab308;font-size:20px;margin:0 0 8px;">Payment failed</h1>
        <p style="line-height:1.6;color:#ccc;">We weren't able to process your latest Phaos AI invoice for $${(invoice.amount_due / 100).toFixed(2)}.</p>
        <p style="line-height:1.6;color:#ccc;">Please update your payment method in your billing settings to avoid service interruption.</p>
      `),
    });
  }
}

// On checkout.session.completed, hand off to the QStash-backed Retell
// provisioning pipeline. The Stripe event id is the idempotency key so
// retries never double-provision.
async function handleCheckoutCompleted(session: any, eventId: string) {
  const md = session.metadata ?? {};
  const customerEmail = session.customer_details?.email ?? md.email_address ?? null;
  const companyName = md.company_name ?? session.customer_details?.name ?? "New Customer";
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/provision-enqueue`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-token": Deno.env.get("SERVICE_API_KEY") ?? "",
      },
      body: JSON.stringify({
        stripe_event_id: eventId,
        company_name: companyName,
        area_code: md.area_code ?? "415",
        website_url: md.website_url,
        email_address: customerEmail,
        metadata: { source: "stripe_checkout", session_id: session.id },
      }),
    });
    if (!res.ok) console.error("[payments-webhook] provision-enqueue failed", res.status, await res.text());
  } catch (e) {
    console.error("[payments-webhook] provision-enqueue error", e);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  try {
    const event = await verifyWebhook(req, env);
    const eventId = event.id ?? `${event.type}-${Date.now()}`;
    const obj = event.data.object;

    // Idempotency check
    const { data: existing } = await supa()
      .from("billing_events")
      .select("id")
      .eq("stripe_event_id", eventId)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let orgId: string | null = null;
    if (obj.customer) orgId = await findOrgByStripeCustomerId(obj.customer);
    await logEvent(orgId, event.type, eventId, obj);

    switch (event.type) {
      case "setup_intent.succeeded":
        await handleSetupIntentSucceeded(obj, env);
        break;
      case "checkout.session.completed":
        await handleCheckoutCompleted(obj, eventId);
        break;
      case "invoice.payment_succeeded":
      case "invoice.paid":
        await handleInvoicePaymentSucceeded(obj);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(obj);
        break;
      case "payment_method.detached":
        if (orgId) {
          await supa()
            .from("organizations")
            .update({
              stripe_payment_method_id: null,
              stripe_payment_method_verified: false,
              card_brand: null,
              card_last4: null,
              billing_status: "inactive",
            })
            .eq("id", orgId);
        }
        break;
      default:
        console.log("[payments-webhook] unhandled:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[payments-webhook] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
