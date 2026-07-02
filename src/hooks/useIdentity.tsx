import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PortalAccountStatus =
  | "active"
  | "trial"
  | "pending_approval"
  | "suspended"
  | "deactivated";

export type PortalPlatformRole =
  | "internal_super_admin"
  | "internal_operator"
  | "customer_owner"
  | "customer_admin"
  | "location_manager"
  | "viewer"
  | "trial_user";

export interface Identity {
  userId: string;
  email: string;
  fullName: string | null;
  /** Server-enforced: true only if email is one of the 3 hardcoded internal operators. */
  isInternal: boolean;
  platformRole: PortalPlatformRole | null;
  accountStatus: PortalAccountStatus | null;
}

type State =
  | { status: "loading"; identity: null; error: null }
  | { status: "unauthenticated"; identity: null; error: null }
  | { status: "ready"; identity: Identity; error: null }
  | { status: "error"; identity: null; error: string };

/**
 * Resolves the current user's identity from Supabase auth + portal_user_profiles
 * and verifies internal-operator status server-side via RPC. Frontend NEVER trusts
 * a client-side email check — we ask the database.
 */
export function useIdentity(): State {
  const [state, setState] = useState<State>({
    status: "loading",
    identity: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function resolve(userId: string, email: string) {
      try {
        // Server-side internal operator check (hardcoded allowlist in DB).
        const [internalRes, profileRes] = await Promise.all([
          supabase.rpc("is_internal_operator", { _user_id: userId }),
          supabase
            .from("portal_user_profiles")
            .select("full_name, platform_role, account_status, is_internal")
            .eq("id", userId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (internalRes.error) {
          setState({
            status: "error",
            identity: null,
            error: internalRes.error.message,
          });
          return;
        }

        const isInternal = Boolean(internalRes.data);
        const profile = profileRes.data;

        setState({
          status: "ready",
          identity: {
            userId,
            email,
            fullName: profile?.full_name ?? null,
            isInternal,
            platformRole:
              (profile?.platform_role as PortalPlatformRole | undefined) ??
              (isInternal ? "internal_super_admin" : "trial_user"),
            accountStatus:
              (profile?.account_status as PortalAccountStatus | undefined) ??
              (isInternal ? "active" : "trial"),
          },
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          identity: null,
          error: err instanceof Error ? err.message : "Identity lookup failed",
        });
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session?.user) {
        setState({ status: "unauthenticated", identity: null, error: null });
      } else {
        void resolve(session.user.id, session.user.email ?? "");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session?.user) {
        setState({ status: "unauthenticated", identity: null, error: null });
      } else {
        void resolve(data.session.user.id, data.session.user.email ?? "");
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
