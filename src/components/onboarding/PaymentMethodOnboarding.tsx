import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2, CreditCard, ShieldCheck, Sparkles, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import phaosLogo from "@/assets/phaos-logo.png";

interface Props {
  onComplete: () => void;
  onDismiss?: () => void;
}

/**
 * Card-on-file collection screen shown BEFORE the onboarding wizard.
 * Uses Stripe SetupIntent (no charge — saves a payment method for
 * later monthly invoicing of voice usage at $0.20/min).
 */
export function PaymentMethodOnboarding({ onComplete, onDismiss }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "create-setup-intent",
          { body: { environment: getStripeEnvironment() } },
        );
        if (cancelled) return;
        if (error) throw error;
        if (!data?.clientSecret) throw new Error("No client secret returned");
        setClientSecret(data.clientSecret);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            appearance: {
              theme: "night" as const,
              variables: {
                colorPrimary: "#a855f7",
                colorBackground: "#141414",
                colorText: "#e5e5e5",
                colorTextSecondary: "#888",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                borderRadius: "10px",
              },
            },
          }
        : undefined,
    [clientSecret],
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-6 py-4 border-b border-border/40 flex items-center gap-3">
        <img src={phaosLogo} alt="Phaos AI" className="w-8 h-8 rounded-lg" />
        <div className="flex-1">
          <div className="text-sm font-bold tracking-tight">Phaos AI</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Activate your VIP Early Adopter account
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close — set up payment later"
            className="w-8 h-8 inline-flex items-center justify-center rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-border bg-secondary/40 transition-colors"
            title="Set up payment later"
          >
            <X size={14} />
          </button>
        )}
      </header>

      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-3xl grid md:grid-cols-[1fr_1.2fr] gap-6">
          {/* Left — value */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-[10px] uppercase tracking-widest font-bold text-primary">
              <Sparkles size={11} /> VIP Early Adopter
            </div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight">
              $0 setup. <span className="text-primary">$0/month.</span>
              <br />
              Pay only for what you use.
            </h1>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <Bullet>
                <strong className="text-foreground">$0.20 per minute</strong>{" "}
                of Phoebe runtime, billed monthly to the card on file.
              </Bullet>
              <Bullet>
                <strong className="text-foreground">No charge today</strong> —
                we only authorize the card.
              </Bullet>
              <Bullet>
                <strong className="text-foreground">Cancel anytime</strong>{" "}
                with a 30-day grace period and full data export.
              </Bullet>
              <Bullet>
                <strong className="text-foreground">VIP rate locked</strong>{" "}
                for the lifetime of your account.
              </Bullet>
            </ul>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 pt-2">
              <Lock size={11} /> Card stored securely with Stripe. Phaos never
              sees your card number.
            </div>
          </div>

          {/* Right — payment form */}
          <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={16} className="text-primary" />
              <h2 className="text-base font-bold">Add your payment method</h2>
            </div>

            {loadError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                Could not initialize payment form: {loadError}
              </div>
            )}

            {!clientSecret && !loadError && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            {clientSecret && options && (
              <Elements stripe={getStripe()} options={options}>
                <PaymentForm onComplete={onComplete} />
              </Elements>
            )}

            <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <ShieldCheck size={11} className="text-primary" />
                Bank-grade encryption · PCI DSS compliant
              </div>
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                >
                  Soon, Not Yet →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function PaymentForm({ onComplete }: { onComplete: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/`,
      },
      redirect: "if_required",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Payment method could not be saved");
      return;
    }
    toast.success("Payment method saved — welcome to Phaos AI");
    // Webhook will set stripe_payment_method_verified = true; give it a beat then proceed.
    setTimeout(onComplete, 800);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: { type: "tabs", defaultCollapsed: false },
        }}
      />
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ShieldCheck size={14} />
        )}
        {submitting ? "Saving…" : "Authorize card & activate workspace"}
      </button>
      <p className="text-[11px] text-muted-foreground/80 text-center leading-relaxed">
        You'll be charged $0.00 today. Future invoices are based on actual
        voice minutes used at $0.20/min.
      </p>
    </form>
  );
}
