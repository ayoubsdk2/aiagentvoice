import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CurrentOrg {
  id: string;
  slug: string;
  name: string;
  billing_email: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_verified: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  branding: {
    logo_url: string | null;
    primary_color: string;
    display_name: string | null;
  } | null;
  role: "owner" | "admin" | "manager" | "viewer" | null;
}

interface State {
  status: "loading" | "ready" | "none" | "error";
  org: CurrentOrg | null;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Resolves the signed-in user's primary organization (their first/owner org)
 * along with branding and onboarding state.
 */
export function useCurrentOrg(): State {
  const [status, setStatus] = useState<State["status"]>("loading");
  const [org, setOrg] = useState<CurrentOrg | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus((prev) => (prev === "ready" ? prev : "loading"));
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user?.id) {
        setStatus("none");
        setOrg(null);
        return;
      }

      // Get earliest membership (owner of the bootstrap org)
      const { data: mem, error: memErr } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (memErr) throw memErr;
      if (!mem) {
        setStatus("none");
        setOrg(null);
        return;
      }

      const [{ data: o, error: oErr }, { data: b }] = await Promise.all([
        supabase
          .from("organizations")
          .select(
            "id, slug, name, billing_email, stripe_customer_id, stripe_payment_method_verified, onboarding_completed, onboarding_step",
          )
          .eq("id", mem.organization_id)
          .maybeSingle(),
        supabase
          .from("organization_branding")
          .select("logo_url, primary_color, display_name")
          .eq("organization_id", mem.organization_id)
          .maybeSingle(),
      ]);

      if (oErr) throw oErr;
      if (!o) {
        setStatus("none");
        setOrg(null);
        return;
      }

      setOrg({
        ...o,
        branding: b ?? { logo_url: null, primary_color: "#a855f7", display_name: null },
        role: mem.role as CurrentOrg["role"],
      });
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) void load();
      else {
        setStatus("none");
        setOrg(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  return { status, org, error, refresh: load };
}
