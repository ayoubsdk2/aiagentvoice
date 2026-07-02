// Client helper for the /admin credential gate.
// Stores a short-lived HMAC token issued by the `admin-gate` edge function
// and exposes helpers for calling token-gated edge functions like
// `admin-api` and `soa-alert`.
const STORAGE_KEY = "phaos_admin_session_v1";

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearAdminToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function functionUrl(name: string, pathOrParams?: string | Record<string, string>, params?: Record<string, string>): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) throw new Error("VITE_SUPABASE_URL missing");
  let pathSuffix = "";
  let queryParams: Record<string, string> | undefined;
  if (typeof pathOrParams === "string") {
    pathSuffix = pathOrParams.startsWith("/") ? pathOrParams : `/${pathOrParams}`;
    queryParams = params;
  } else {
    queryParams = pathOrParams;
  }
  const u = new URL(`${base}/functions/v1/${name}${pathSuffix}`);
  if (queryParams) for (const [k, v] of Object.entries(queryParams)) u.searchParams.set(k, v);
  return u.toString();
}

export async function loginAdmin(username: string, password: string): Promise<void> {
  const res = await fetch(functionUrl("admin-gate", { action: "login" }), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error === "invalid_credentials" ? "Invalid username or password." : "Login failed.");
  }
  const data = (await res.json()) as { token: string };
  setAdminToken(data.token);
}

export async function resetAdminPassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(functionUrl("admin-gate", { action: "reset-password" }), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const code = (data as { error?: string })?.error;
    if (code === "invalid_current_password") throw new Error("Current password is incorrect.");
    if (code === "new_password_too_short") throw new Error("New password must be at least 10 characters.");
    throw new Error("Password reset failed.");
  }
}



export async function verifyAdminToken(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) return false;
  try {
    const res = await fetch(functionUrl("admin-gate", { action: "verify" }), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      clearAdminToken();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ---- Admin API helpers ----

type AdminFetchInit = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string>;
  body?: unknown;
};

export async function adminFetch<T = unknown>(
  fn: "admin-api" | "soa-alert" | "cartesia-voices",
  path: string,
  init: AdminFetchInit = {},
): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new Error("admin_not_signed_in");
  const url = functionUrl(fn, path, init.query);
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: string })?.error ?? `admin_api_${res.status}`;
    throw new Error(message);
  }
  return data as T;
}
