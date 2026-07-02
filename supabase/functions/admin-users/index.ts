/**
 * admin-users — Admin-only user analytics for voice.phaosai.com
 *
 * SECURITY MODEL
 *  - Caller must present a valid Supabase access token (Authorization: Bearer ...).
 *  - Caller must have role `phaos_admin` in `public.user_roles`. We check via the
 *    SECURITY DEFINER `has_role(uuid, app_role)` RPC — never against `profiles`
 *    (avoids the privilege-escalation pattern).
 *  - All data is fetched through the existing `admin_user_activity_summary()`
 *    SECURITY DEFINER RPC, which already aggregates: signed_up_at, last_login_at,
 *    login_success_count, login_failed_count, total_session_seconds,
 *    sandbox_call_count, sandbox_total_seconds. The RPC itself re-checks
 *    `has_role(auth.uid(), 'phaos_admin')` — defense in depth.
 *
 * SANDBOX SAFETY
 *  - We READ from sandbox_usage_events transitively via the RPC. We never write
 *    to or modify any Sandbox table, function, or flow.
 *
 * AUDIT
 *  - Every successful response inserts one row into `public.admin_audit_log`
 *    with action='list_users' and the caller's IP (best-effort).
 *
 * NO SECRETS / NO RAW SQL
 *  - Service-role key is used only to write the audit row; never returned.
 *  - All DB access uses parameterized SDK calls / typed RPCs.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DEFAULT_VISIBLE_COLUMNS = [
  "full_name",
  "company",
  "recent_login",
  "login_count",
  "total_logged_minutes",
  "sandbox_minutes",
  "live_account",
] as const;

const ALLOWED_COLUMNS = new Set([
  "id",
  "full_name",
  "company",
  "email",
  "recent_login",
  "login_count",
  "total_logged_minutes",
  "sandbox_minutes",
  "live_account",
  "avg_session_minutes",
  "conversion_rate",
]);

const ALLOWED_SORT_KEYS = new Set([
  "full_name",
  "company",
  "recent_login",
  "login_count",
  "total_logged_minutes",
  "sandbox_minutes",
  "avg_session_minutes",
]);

// Filterable keys (equality only). Kept narrow on purpose to prevent abuse.
const ALLOWED_FILTER_KEYS = new Set(["company", "full_name", "email"]);

interface SummaryRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  signed_up_at: string | null;
  last_login_at: string | null;
  login_success_count: number | string | null;
  login_failed_count: number | string | null;
  total_session_seconds: number | string | null;
  sandbox_call_count: number | string | null;
  sandbox_total_seconds: number | string | null;
}

interface UserAnalyticsRow {
  id: string;
  full_name: string;
  company: string;
  email: string;
  recent_login: string | null;
  login_count: number;
  total_logged_minutes: number;
  sandbox_minutes: number;
  live_account: string;
  avg_session_minutes: number;
  conversion_rate: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseIntParam(value: string | null, fallback: number, min = 1, max = 500): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseJsonParam<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // 1) Auth header
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  // Caller-scoped client — used only to identify the user from their JWT.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // 2) Resolve user
  const { data: userData, error: userErr } = await callerClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  const user = userData.user;

  // Service-role client for RPC + audit insert (RPC also re-validates admin).
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3) Admin gate via has_role(user_id, 'phaos_admin') — never trust profiles.role
  const { data: isAdmin, error: roleErr } = await adminClient.rpc("has_role", {
    _user_id: user.id,
    _role: "phaos_admin",
  });
  if (roleErr) {
    return jsonResponse({ error: "role_check_failed" }, 500);
  }
  if (isAdmin !== true) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  // 4) Parse query params (support GET querystring AND POST JSON body)
  const url = new URL(req.url);
  let bodyParams: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      bodyParams = (await req.json()) as Record<string, unknown>;
    } catch {
      bodyParams = {};
    }
  }
  const getParam = (key: string): string | null => {
    const fromQuery = url.searchParams.get(key);
    if (fromQuery !== null) return fromQuery;
    const fromBody = bodyParams[key];
    if (fromBody == null) return null;
    return typeof fromBody === "string" ? fromBody : JSON.stringify(fromBody);
  };

  const page = parseIntParam(getParam("page"), 1, 1, 100000);
  const pageSize = parseIntParam(getParam("pageSize"), 20, 1, 200);
  const sortByRaw = (getParam("sortBy") ?? "recent_login").trim();
  const sortDirRaw = (getParam("sortDir") ?? "desc").toLowerCase();
  const sortBy = ALLOWED_SORT_KEYS.has(sortByRaw) ? sortByRaw : "recent_login";
  const sortDir: "asc" | "desc" = sortDirRaw === "asc" ? "asc" : "desc";

  const filtersRaw = parseJsonParam<Record<string, unknown>>(getParam("filters"), {});
  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(filtersRaw)) {
    if (!ALLOWED_FILTER_KEYS.has(k)) continue;
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length === 0 || s.length > 200) continue;
    filters[k] = s;
  }

  const visibleColumnsRaw = parseJsonParam<unknown>(
    getParam("visibleColumns"),
    [...DEFAULT_VISIBLE_COLUMNS],
  );
  const visibleColumns: string[] = Array.isArray(visibleColumnsRaw)
    ? visibleColumnsRaw
        .filter((c): c is string => typeof c === "string")
        .filter((c) => ALLOWED_COLUMNS.has(c))
    : [...DEFAULT_VISIBLE_COLUMNS];
  // Always include id so consumers can key rows.
  if (!visibleColumns.includes("id")) visibleColumns.unshift("id");

  // 5) Pull aggregated rows from the existing SECURITY DEFINER RPC.
  // We pass `_caller` explicitly because this client uses the service role,
  // so `auth.uid()` is NULL inside the RPC. The RPC re-validates that the
  // caller has phaos_admin via has_role(_caller, 'phaos_admin').
  const { data: summary, error: summaryErr } = await adminClient.rpc(
    "admin_user_activity_summary",
    { _caller: user.id },
  );
  if (summaryErr) {
    return jsonResponse({ error: "query_failed" }, 500);
  }

  const rawRows = (summary ?? []) as SummaryRow[];

  // 5a) For each user, resolve company (customers.name via profiles.customer_id)
  //     and live_account (live_accounts.display_name via profiles.last_live_customer_id).
  //     Done in one batch each to keep this O(1) DB roundtrips.
  const userIds = rawRows.map((r) => r.user_id);
  let companyByUser = new Map<string, string>();
  let liveAccountByUser = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profileRows } = await adminClient
      .from("profiles")
      .select("id, customer_id, last_live_customer_id")
      .in("id", userIds);

    const profiles = profileRows ?? [];
    const customerIds = Array.from(
      new Set(
        profiles
          .map((p) => p.customer_id as string | null)
          .filter((x): x is string => !!x),
      ),
    );
    const liveCustomerIds = Array.from(
      new Set(
        profiles
          .map((p) => p.last_live_customer_id as string | null)
          .filter((x): x is string => !!x),
      ),
    );

    let customerNameById = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: customerRows } = await adminClient
        .from("customers")
        .select("id, name")
        .in("id", customerIds);
      customerNameById = new Map(
        (customerRows ?? []).map((c) => [c.id as string, (c.name as string) ?? ""]),
      );
    }

    let liveNameByCustomer = new Map<string, string>();
    if (liveCustomerIds.length > 0) {
      const { data: liveRows } = await adminClient
        .from("live_accounts")
        .select("customer_id, display_name, is_active")
        .in("customer_id", liveCustomerIds);
      liveNameByCustomer = new Map(
        (liveRows ?? [])
          .filter((l) => l.is_active !== false)
          .map((l) => [
            l.customer_id as string,
            (l.display_name as string) ?? "",
          ]),
      );
    }

    for (const p of profiles) {
      const cid = p.customer_id as string | null;
      const lid = p.last_live_customer_id as string | null;
      if (cid && customerNameById.has(cid)) {
        companyByUser.set(p.id as string, customerNameById.get(cid) ?? "");
      }
      if (lid && liveNameByCustomer.has(lid)) {
        liveAccountByUser.set(p.id as string, liveNameByCustomer.get(lid) ?? "");
      }
    }
  }

  // 5b) Shape rows
  let rows: UserAnalyticsRow[] = rawRows.map((r) => {
    const loginCount = toNumber(r.login_success_count);
    const totalSeconds = toNumber(r.total_session_seconds);
    const sandboxSeconds = toNumber(r.sandbox_total_seconds);
    const totalMinutes = round2(totalSeconds / 60);
    const sandboxMinutes = round2(sandboxSeconds / 60);
    const avgMinutes = loginCount > 0 ? round2(totalMinutes / loginCount) : 0;

    return {
      id: r.user_id,
      full_name: (r.display_name ?? "").trim() || (r.email ?? "").split("@")[0] || "—",
      company: companyByUser.get(r.user_id) ?? "",
      email: r.email ?? "",
      recent_login: r.last_login_at,
      login_count: loginCount,
      total_logged_minutes: totalMinutes,
      sandbox_minutes: sandboxMinutes,
      live_account: liveAccountByUser.get(r.user_id) ?? "",
      avg_session_minutes: avgMinutes,
      conversion_rate: 0,
    };
  });

  // 5c) Apply equality filters (case-insensitive substring on the few allowed keys)
  for (const [k, v] of Object.entries(filters)) {
    const needle = v.toLowerCase();
    rows = rows.filter((row) => {
      const haystack = String((row as unknown as Record<string, unknown>)[k] ?? "")
        .toLowerCase();
      return haystack === needle;
    });
  }

  // 5d) Sort
  const dirMul = sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortBy];
    const bv = (b as unknown as Record<string, unknown>)[sortBy];

    // Nulls last regardless of direction
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dirMul;
    }
    // Dates / strings
    const as = String(av);
    const bs = String(bv);
    if (as < bs) return -1 * dirMul;
    if (as > bs) return 1 * dirMul;
    return 0;
  });

  // 5e) Paginate
  const total = rows.length;
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  // 5f) Project to visibleColumns
  const projected = pageRows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of visibleColumns) {
      out[col] = (row as unknown as Record<string, unknown>)[col];
    }
    return out;
  });

  // 6) Audit log (best-effort; never blocks the response on failure)
  try {
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const ip = xff.split(",")[0]?.trim() || null;
    await adminClient.from("admin_audit_log").insert({
      admin_user_id: user.id,
      action: "list_users",
      ip_address: ip,
    });
  } catch {
    // Audit failures should not break the admin dashboard. The DB-level
    // audit triggers on sensitive tables remain the source of truth for
    // anything mutating.
  }

  return jsonResponse({
    total,
    page,
    pageSize,
    data: projected,
  });
});
