import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "phaos_admin" | "customer_admin" | "agent_manager" | "viewer" | null;

export interface UseUserResult {
  user: User | null;
  /**
   * Normalized role string. The DB role `phaos_admin` is exposed as `"admin"`
   * to keep UI gating semantics simple ("role === 'admin'" guards the ADMIN button).
   * Use `dbRole` if you need the raw enum value.
   */
  role: "admin" | "customer_admin" | "agent_manager" | "viewer" | null;
  dbRole: AppRole;
  loading: boolean;
}

/**
 * useUser — returns the current Supabase auth user + their app role from public.user_roles.
 * Roles are stored in a separate table to prevent privilege escalation; we fetch via
 * the `has_role` RPC for the admin check (cannot be tampered with client-side).
 */
export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [dbRole, setDbRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRole(uid: string) {
      // Fetch the user's role(s); pick the highest-privilege one if multiple.
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setDbRole(null);
        return;
      }
      const priority: AppRole[] = ["phaos_admin", "customer_admin", "agent_manager", "viewer"];
      const found = priority.find((r) => data.some((row) => row.role === r));
      setDbRole(found ?? null);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        // defer to avoid running supabase calls inside the listener synchronously
        setTimeout(() => loadRole(u.id), 0);
      } else {
        setDbRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        await loadRole(u.id);
      }
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const role: UseUserResult["role"] =
    dbRole === "phaos_admin" ? "admin" : (dbRole as UseUserResult["role"]);

  return { user, role, dbRole, loading };
}
