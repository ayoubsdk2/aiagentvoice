import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin step-up guard:
 * - Allows non-admins straight through (they aren't covered by AAL2 enforcement here).
 * - For phaos_admin, requires an MFA factor verified at AAL2 in the current session.
 *   Otherwise redirects to /mfa-challenge (or /mfa-setup if no factor exists).
 */
export function RequireAdminAAL2({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "needs-mfa-setup" | "needs-mfa-challenge" | "not-admin-ok">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return; // RequireAuth handles unauthenticated redirect
      const { data: roleCheck } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "phaos_admin" });
      if (!roleCheck) {
        if (!cancelled) setState("not-admin-ok");
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        if (!cancelled) setState("ok");
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerified = (factors?.totp ?? []).some((f) => f.status === "verified");
      if (!cancelled) setState(hasVerified ? "needs-mfa-challenge" : "needs-mfa-setup");
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (state === "needs-mfa-setup") return <Navigate to="/mfa-setup" replace />;
  if (state === "needs-mfa-challenge") return <Navigate to="/mfa-challenge" replace />;
  return <>{children}</>;
}
