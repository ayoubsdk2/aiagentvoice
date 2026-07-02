import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIdentity } from "@/hooks/useIdentity";

/**
 * Server-checked guard for internal-only routes (SOA AI App, Live Accounts,
 * Content Lab, QA Dashboard, KPI Admin, etc.). The decision is made by the
 * Postgres function `is_internal_operator()` which hardcodes the 3 operator
 * emails — frontend cannot bypass it.
 *
 * Customer users that try to type these URLs are bounced to `/`.
 */
export function RequireInternal({ children }: { children: ReactNode }) {
  const state = useIdentity();

  if (state.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (state.status === "unauthenticated") return <Navigate to="/auth" replace />;
  if (state.status === "error" || !state.identity.isInternal) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
