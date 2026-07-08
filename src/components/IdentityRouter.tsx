import { lazy, Suspense, useState } from "react";
import { Navigate } from "react-router-dom";
import { useIdentity } from "@/hooks/useIdentity";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { PaymentMethodOnboarding } from "@/components/onboarding/PaymentMethodOnboarding";
import Index from "@/pages/Index";

const CustomerPortal = lazy(() => import("@/pages/CustomerPortal"));
const PendingApproval = lazy(() => import("@/pages/PendingApproval"));
const Suspended = lazy(() => import("@/pages/Suspended"));

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/**
 * Decides which post-login experience to render based on server-resolved identity.
 *
 * Routing rules (server-enforced via is_internal_operator() RPC + portal_user_profiles):
 *   - is_internal === true → existing internal sandbox (Index) — UNCHANGED
 *   - account_status = pending_approval → /pending screen
 *   - account_status = suspended | deactivated → /suspended screen
 *   - everyone else (active, trial)        → new CustomerPortal
 */
export function IdentityRouter() {
  const state = useIdentity();

  if (state.status === "loading") return <Loader />;
  if (state.status === "unauthenticated") return <Navigate to="/auth" replace />;

  if (state.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="glass-card max-w-md p-6 text-center space-y-3">
          <h1 className="text-lg font-bold">Could not verify your account</h1>
          <p className="text-sm text-muted-foreground">{state.error}</p>
          <a
            href="/auth"
            className="inline-block mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
          >
            Return to sign in
          </a>
        </div>
      </div>
    );
  }

  const { isInternal, accountStatus } = state.identity;

  // Internal operators ALWAYS see the existing layout — zero regression.
  if (isInternal) return <Index />;

  if (accountStatus === "pending_approval") {
    return (
      <Suspense fallback={<Loader />}>
        <PendingApproval />
      </Suspense>
    );
  }

  if (accountStatus === "suspended" || accountStatus === "deactivated") {
    return (
      <Suspense fallback={<Loader />}>
        <Suspended status={accountStatus} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Loader />}>
      <CustomerEntry />
    </Suspense>
  );
}

/**
 * For external customers: gate the portal behind onboarding completion.
 * Brand-new signups (and the existing Daniel@SlashShield.com test) land
 * here with a stub org auto-created by the bootstrap_org_after_signup
 * trigger and walk through the 4-step wizard before seeing the dashboard.
 */
function CustomerEntry() {
  const { status, org, refresh } = useCurrentOrg();
  const [forceComplete, setForceComplete] = useState(false);
  const [paymentDismissed, setPaymentDismissed] = useState(
    () => sessionStorage.getItem("phaos_payment_dismissed") === "1",
  );

  if (status === "loading") return <Loader />;
  if (status === "error") return <Loader />;

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="glass-card max-w-md p-6 text-center space-y-4">
          <h1 className="text-xl font-bold">Organization missing</h1>
          <p className="text-sm text-muted-foreground">
            Your account was created before the organization setup triggers were fully deployed, so it is currently unlinked.
          </p>
          <button
            onClick={async () => {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Not authenticated");
                
                // 1. Create the org
                const { data: newOrg, error: orgErr } = await supabase
                  .from("organizations")
                  .insert({
                    slug: `org-${Date.now()}`,
                    name: "My Organization",
                    created_by: user.id,
                    billing_email: user.email,
                    onboarding_completed: false,
                    onboarding_step: 1
                  })
                  .select("id")
                  .single();
                  
                if (orgErr) throw orgErr;

                // 2. Add the user as owner
                const { error: memErr } = await supabase
                  .from("organization_members")
                  .insert({
                    organization_id: newOrg.id,
                    user_id: user.id,
                    role: "owner"
                  });

                if (memErr) throw memErr;
                
                // 3. Refresh state
                toast.success("Organization created!");
                void refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to create organization");
              }
            }}
            className="w-full px-4 py-2 mt-4 text-sm font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create My Organization
          </button>
        </div>
      </div>
    );
  }

  // Step 0 — payment method must be on file before any other onboarding
  // (unless the user dismissed it for this session).
  if (org && !org.stripe_payment_method_verified && !paymentDismissed) {
    return (
      <PaymentMethodOnboarding
        onComplete={() => {
          void refresh();
        }}
        onDismiss={() => {
          sessionStorage.setItem("phaos_payment_dismissed", "1");
          setPaymentDismissed(true);
        }}
      />
    );
  }

  if (org && !org.onboarding_completed && !forceComplete) {
    return (
      <OnboardingWizard
        onComplete={() => {
          setForceComplete(true);
          void refresh();
        }}
      />
    );
  }

  return <CustomerPortal />;
}
