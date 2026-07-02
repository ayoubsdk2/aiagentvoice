import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IdentityRouter } from "./IdentityRouter";

const SandboxPublic = lazy(() => import("@/pages/SandboxPublic"));

/**
 * Root route: public Sandbox by default, admin app when authenticated.
 * Never blocks visitors — anonymous users get straight into the Sandbox.
 */
export function RootRoute() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
    });
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // While checking, show the Sandbox immediately (don't gate visitors).
  if (authed) return <IdentityRouter />;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SandboxPublic />
    </Suspense>
  );
}
