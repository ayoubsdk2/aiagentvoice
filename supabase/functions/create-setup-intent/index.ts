// Creates a Stripe SetupIntent so the user can save a card during onboarding
// (no charge, just authorization). Returns { clientSecret, customerId }.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  createStripeClient,
  corsHeaders,
} from "../_shared/stripe.ts";

const supabaseAdmin = createClient(
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
    const { data: u, error: ue } = await supabaseAdmin.auth.getUser(token);
    if (ue || !u?.user) throw new Error("Unauthorized");
    const userId = u.user.id;
    const userEmail = u.user.email!;

    const body = await req.json().catch(() => ({}));
    const env: StripeEnv = body.environment === "live" ? "live" : "sandbox";

    // Find the user's primary org
    const { data: mem } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!mem) throw new Error("No organization");

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name, billing_email, stripe_customer_id")
      .eq("id", mem.organization_id)
      .maybeSingle();
    if (!org) throw new Error("Organization not found");

    const stripe = createStripeClient(env);

    // Find or create the Stripe customer
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.billing_email || userEmail,
        name: org.name,
        metadata: {
          organization_id: org.id,
          user_id: userId,
          plan: "vip_early_adopter",
        },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org.id);
    }

    // Create SetupIntent — saves card without charging
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session", // We'll charge it monthly without the user present
      metadata: {
        organization_id: org.id,
        user_id: userId,
      },
    });

    return new Response(
      JSON.stringify({
        clientSecret: setupIntent.client_secret,
        customerId,
        publishableKey: env === "live"
          ? Deno.env.get("STRIPE_LIVE_PUBLISHABLE_KEY")
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[create-setup-intent]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
