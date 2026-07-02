import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AccountMode = "prototype" | "live";

interface LiveAccountInfo {
  customerId: string;
  displayName: string;
}

interface AccountModeContextValue {
  mode: AccountMode;
  liveAccount: LiveAccountInfo | null;
  /** customer id when mode === "live", otherwise null */
  currentLiveCustomerId: string | null;
  /** True if a live account has been unlocked in this session (toggle becomes available). */
  liveUnlocked: boolean;
  /** Validate and unlock a code. Returns null on success, error message on failure. */
  redeemCode: (code: string) => Promise<string | null>;
  /** Switch between prototype and live (only meaningful when liveUnlocked). */
  setMode: (m: AccountMode) => void;
  /** Alias of setMode — matches the API requested by Prompt 2. */
  switchMode: (m: AccountMode) => void;
  /**
   * Manually bind a live customer (admin/test paths). The normal flow uses
   * redeemCode, but this lets callers swap the active live tenant when one is
   * already unlocked. No-op if no liveAccount is bound.
   */
  setLiveCustomer: (customerId: string) => void;
  /** Reset to prototype and forget the bound live customer (sign-out style). */
  clearLive: () => Promise<void>;
}

const STORAGE_KEY = "phaos:accountMode";

const AccountModeContext = createContext<AccountModeContextValue | null>(null);

export function AccountModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AccountMode>("prototype");
  const [liveAccount, setLiveAccount] = useState<LiveAccountInfo | null>(null);

  // Hydrate from localStorage immediately (per-device preference)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "live" || raw === "prototype") {
        setModeState(raw);
      }
    } catch { /* ignore */ }
  }, []);

  // On mount, try to load the user's bound live account from the server (hybrid persistence).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled || !sessionData.session) return;
        const { data, error } = await supabase.rpc("get_my_live_account");
        if (cancelled || error || !data || !Array.isArray(data) || data.length === 0) return;
        const row = data[0] as { customer_id: string; display_name: string; is_active: boolean };
        if (!row.is_active) return;
        setLiveAccount({ customerId: row.customer_id, displayName: row.display_name });
      } catch {
        /* unauthenticated or RPC unavailable — silently stay in prototype */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setMode = useCallback((m: AccountMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* ignore */ }
    // Best-effort server persist; ignore failures (e.g. anon user)
    void (async () => { try { await supabase.rpc("set_account_mode", { _mode: m }); } catch { /* ignore */ } })();
  }, []);

  const redeemCode = useCallback(async (code: string): Promise<string | null> => {
    const trimmed = code.trim();
    if (trimmed.length < 5) return "Access code must be at least 5 characters.";
    try {
      const { data, error } = await supabase.rpc("redeem_live_access_code", { _code: trimmed });
      if (error) {
        if (/auth/i.test(error.message)) return "Sign in required to unlock live mode.";
        return "Access code not recognized – contact your Phaos representative.";
      }
      const rows = (data ?? []) as Array<{ customer_id: string; display_name: string }>;
      if (rows.length === 0) {
        return "Access code not recognized – contact your Phaos representative.";
      }
      const row = rows[0];
      setLiveAccount({ customerId: row.customer_id, displayName: row.display_name });
      setModeState("live");
      try { localStorage.setItem(STORAGE_KEY, "live"); } catch { /* ignore */ }
      return null;
    } catch {
      return "Unable to verify code right now. Please try again.";
    }
  }, []);

  const clearLive = useCallback(async () => {
    setLiveAccount(null);
    setModeState("prototype");
    try { localStorage.setItem(STORAGE_KEY, "prototype"); } catch { /* ignore */ }
    try { await supabase.rpc("set_account_mode", { _mode: "prototype" }); } catch { /* ignore */ }
  }, []);

  const setLiveCustomer = useCallback((customerId: string) => {
    setLiveAccount((prev) => (prev ? { ...prev, customerId } : prev));
  }, []);

  const value = useMemo<AccountModeContextValue>(() => ({
    mode: liveAccount ? mode : "prototype", // safety: cannot be in live without a bound account
    liveAccount,
    currentLiveCustomerId: liveAccount && mode === "live" ? liveAccount.customerId : null,
    liveUnlocked: !!liveAccount,
    redeemCode,
    setMode,
    switchMode: setMode,
    setLiveCustomer,
    clearLive,
  }), [mode, liveAccount, redeemCode, setMode, setLiveCustomer, clearLive]);

  return <AccountModeContext.Provider value={value}>{children}</AccountModeContext.Provider>;
}

export function useAccountMode() {
  const ctx = useContext(AccountModeContext);
  if (!ctx) throw new Error("useAccountMode must be used inside AccountModeProvider");
  return ctx;
}
