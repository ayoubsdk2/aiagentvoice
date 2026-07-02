/**
 * Session persistence policy.
 *
 * Runs SYNCHRONOUSLY before the Supabase client initialises (imported from
 * src/main.tsx as the very first line). Decides whether the existing
 * sb-*-auth-token keys in localStorage should survive into this page load.
 *
 * Rules:
 *   - "Remember me on this device" checked at sign-in  →  session may live
 *     across browser/computer restarts, capped at REMEMBER_ME_DAYS.
 *   - "Remember me" NOT checked  →  session only lives for the current
 *     browser session (sessionStorage tab-alive marker). When the user
 *     closes the browser / shuts down, the marker disappears, so on next
 *     launch we wipe the auth tokens and force a fresh login.
 *   - Reloads, in-tab navigations, and opening links in new tabs of the
 *     same window keep the user signed in (tab-alive marker is set).
 *
 * Security notes:
 *   - We never read or transmit the auth tokens here; we only delete them
 *     from localStorage when policy says they should not persist.
 *   - The "remember until" timestamp is a client-side hint only; Supabase
 *     refresh-token rotation is the real authority. Even with remember-me
 *     on, an attacker who steals the refresh token still has to defeat
 *     Supabase's rotation + reuse detection.
 */

const REMEMBER_FLAG_KEY = "lov_remember";
const REMEMBER_UNTIL_KEY = "lov_remember_until";
const TAB_ALIVE_KEY = "lov_tab_alive";

export const REMEMBER_ME_DAYS = 90;

function isLocalStorageAvailable(): boolean {
  try {
    const k = "__lov_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function wipeSupabaseAuthTokens() {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      // Supabase v2 stores tokens as `sb-<ref>-auth-token` (and `.code-verifier`, etc.)
      if (k.startsWith("sb-") && k.includes("-auth-token")) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) window.localStorage.removeItem(k);
  } catch {
    // ignore — nothing we can do, and we'd rather not crash boot
  }
}

/**
 * Call exactly once, before the Supabase client module is evaluated.
 */
export function enforceSessionPersistencePolicy(): void {
  if (typeof window === "undefined") return;
  if (!isLocalStorageAvailable()) return;

  const tabAlive = (() => {
    try {
      return window.sessionStorage.getItem(TAB_ALIVE_KEY) === "1";
    } catch {
      return false;
    }
  })();

  const remember = window.localStorage.getItem(REMEMBER_FLAG_KEY) === "true";
  const untilRaw = window.localStorage.getItem(REMEMBER_UNTIL_KEY);
  const untilMs = untilRaw ? Number(untilRaw) : 0;
  const rememberStillValid =
    remember && Number.isFinite(untilMs) && untilMs > Date.now();

  // If remember-me has expired, drop the flags so the user has to opt-in again.
  if (remember && !rememberStillValid) {
    try {
      window.localStorage.removeItem(REMEMBER_FLAG_KEY);
      window.localStorage.removeItem(REMEMBER_UNTIL_KEY);
    } catch {
      /* noop */
    }
  }

  // Force fresh login when this is a brand-new browser session AND
  // the user has not opted into remember-me (or it has expired).
  if (!tabAlive && !rememberStillValid) {
    wipeSupabaseAuthTokens();
  }

  // Mark this tab as alive for the rest of the session so in-tab reloads
  // and same-tab navigations don't trip the wipe path.
  try {
    window.sessionStorage.setItem(TAB_ALIVE_KEY, "1");
  } catch {
    /* noop */
  }
}

/**
 * Called from the Auth page after a successful sign-in / sign-up.
 */
export function setRememberMe(remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (remember) {
      const until = Date.now() + REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(REMEMBER_FLAG_KEY, "true");
      window.localStorage.setItem(REMEMBER_UNTIL_KEY, String(until));
    } else {
      window.localStorage.removeItem(REMEMBER_FLAG_KEY);
      window.localStorage.removeItem(REMEMBER_UNTIL_KEY);
    }
  } catch {
    /* noop */
  }
}

/**
 * Called on explicit sign-out. Wipes the remember-me hint AND the tab-alive
 * marker so that even within the same tab the next load won't auto-restore.
 */
export function clearSessionPersistence(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REMEMBER_FLAG_KEY);
    window.localStorage.removeItem(REMEMBER_UNTIL_KEY);
    window.sessionStorage.removeItem(TAB_ALIVE_KEY);
    wipeSupabaseAuthTokens();
  } catch {
    /* noop */
  }
}
