import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SampleScope = "local" | "regional" | "national" | "global";

export type DemoModeState =
  | { enabled: false }
  | { enabled: true; scope: SampleScope };

interface DemoModeContextValue {
  state: DemoModeState;
  enable: (scope: SampleScope) => void;
  disable: () => void;
  setScope: (scope: SampleScope) => void;
}

const STORAGE_KEY = "phaos:portal:demoMode";
const URL_PARAM = "sample";

const DemoModeCtx = createContext<DemoModeContextValue | null>(null);

const VALID_SCOPES: SampleScope[] = ["local", "regional", "national", "global"];

function isValidScope(v: unknown): v is SampleScope {
  return typeof v === "string" && (VALID_SCOPES as string[]).includes(v);
}

function readFromUrl(): SampleScope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = new URLSearchParams(window.location.search).get(URL_PARAM);
    return isValidScope(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readFromStorage(): DemoModeState {
  if (typeof window === "undefined") return { enabled: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false };
    const parsed = JSON.parse(raw);
    if (parsed?.enabled === true && isValidScope(parsed.scope)) {
      return { enabled: true, scope: parsed.scope };
    }
  } catch {
    /* ignore */
  }
  return { enabled: false };
}

function readInitial(): DemoModeState {
  // URL wins so a shared link always restores the same view on refresh.
  const fromUrl = readFromUrl();
  if (fromUrl) return { enabled: true, scope: fromUrl };
  return readFromStorage();
}

function syncUrl(state: DemoModeState) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (state.enabled) {
      url.searchParams.set(URL_PARAM, state.scope);
    } else {
      url.searchParams.delete(URL_PARAM);
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", next);
  } catch {
    /* ignore */
  }
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoModeState>({ enabled: false });

  // Hydrate after mount to avoid SSR mismatch.
  useEffect(() => {
    const initial = readInitial();
    setState(initial);
    syncUrl(initial);
  }, []);

  const persist = useCallback((next: DemoModeState) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    syncUrl(next);
  }, []);

  const enable = useCallback(
    (scope: SampleScope) => persist({ enabled: true, scope }),
    [persist],
  );
  const disable = useCallback(() => persist({ enabled: false }), [persist]);
  const setScope = useCallback(
    (scope: SampleScope) => persist({ enabled: true, scope }),
    [persist],
  );

  const value = useMemo<DemoModeContextValue>(
    () => ({ state, enable, disable, setScope }),
    [state, enable, disable, setScope],
  );

  return <DemoModeCtx.Provider value={value}>{children}</DemoModeCtx.Provider>;
}

export function useDemoMode() {
  const ctx = useContext(DemoModeCtx);
  if (!ctx) throw new Error("useDemoMode must be used inside DemoModeProvider");
  return ctx;
}

export const SCOPE_META: Record<
  SampleScope,
  { label: string; subtitle: string }
> = {
  local: {
    label: "Local",
    subtitle: "Central Florida document-solutions dealer",
  },
  regional: {
    label: "Regional",
    subtitle: "Northeast USA copier & MFP group",
  },
  national: {
    label: "National",
    subtitle: "10-city US print-services network",
  },
  global: {
    label: "Global",
    subtitle: "10-country B2B managed-print operation",
  },
};
