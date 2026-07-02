import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/hooks/useIdentity";

export type AnalyticsRole =
  | "customer_owner"
  | "customer_admin"
  | "location_manager"
  | "viewer"
  | "trial_user"
  | "none";

export interface AnalyticsFilters {
  /** ISO range start (inclusive). */
  from: string;
  /** ISO range end (exclusive — i.e. now() snapshot). */
  to: string;
  locationId: string | "all";
  phoneNumberId: string | "all";
}

export interface CallRow {
  id: string;
  org_id: string;
  location_id: string;
  phone_number_id: string;
  agent_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  outcome: string | null;
  ai_resolved: boolean;
  transferred_to_human: boolean;
  created_at: string;
}

export interface LeadRow {
  id: string;
  org_id: string;
  location_id: string | null;
  lead_score: number;
  quote_status: string;
  created_at: string;
}

export interface AnalyticsKPIs {
  totalCalls: number;
  resolvedCalls: number;
  resolutionRate: number; // 0..1
  avgHandleTimeSec: number;
  transferredToHuman: number;
  transferRate: number; // 0..1
  totalSavings: number;
  totalLeads: number;
  qualifiedLeads: number; // lead_score >= 70
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  calls: number;
  resolved: number;
  savings: number;
  cumulativeSavings: number;
}

export interface OutcomeSlice {
  name: string;
  value: number;
}

export interface LocationPerformance {
  location_id: string;
  location_name: string;
  calls: number;
  resolved: number;
  resolutionRate: number;
  savings: number;
  avgHandleTimeSec: number;
}

export interface NumberPerformance {
  phone_number_id: string;
  number: string;
  friendly_name: string | null;
  location_name: string | null;
  calls: number;
  resolved: number;
  resolutionRate: number;
}

export interface AnalyticsState {
  loading: boolean;
  error: string | null;
  role: AnalyticsRole;
  /** Whether the user is restricted to sample-only data (e.g. trial). */
  sampleOnly: boolean;
  orgId: string | null;
  orgName: string | null;
  savingsPerCall: number;
  /** All locations the user can see (already RLS-scoped). */
  locations: { id: string; name: string }[];
  /** All numbers the user can see, filtered by current location. */
  numbers: { id: string; number: string; friendly_name: string | null; location_id: string | null }[];
  filters: AnalyticsFilters;
  setFilters: (patch: Partial<AnalyticsFilters>) => void;
  /** Aggregated values for the current period. */
  kpis: AnalyticsKPIs;
  /** Aggregated values for the previous period of equal length (for delta). */
  prevKpis: AnalyticsKPIs;
  daily: DailyPoint[];
  outcomes: OutcomeSlice[];
  locationPerformance: LocationPerformance[];
  numberPerformance: NumberPerformance[];
  rawCalls: CallRow[];
  rawLeads: LeadRow[];
  refresh: () => Promise<void>;
}

const EMPTY_KPIS: AnalyticsKPIs = {
  totalCalls: 0,
  resolvedCalls: 0,
  resolutionRate: 0,
  avgHandleTimeSec: 0,
  transferredToHuman: 0,
  transferRate: 0,
  totalSavings: 0,
  totalLeads: 0,
  qualifiedLeads: 0,
};

export function defaultFilters(): AnalyticsFilters {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    locationId: "all",
    phoneNumberId: "all",
  };
}

export function useCustomerAnalytics(): AnalyticsState {
  const ident = useIdentity();
  const [filters, setFiltersState] = useState<AnalyticsFilters>(defaultFilters);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [savingsPerCall, setSavingsPerCall] = useState<number>(15);
  const [locations, setLocations] = useState<AnalyticsState["locations"]>([]);
  const [allNumbers, setAllNumbers] = useState<AnalyticsState["numbers"]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [prevCalls, setPrevCalls] = useState<CallRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const role: AnalyticsRole = useMemo(() => {
    if (ident.status !== "ready") return "none";
    const r = ident.identity.platformRole;
    if (
      r === "customer_owner" ||
      r === "customer_admin" ||
      r === "location_manager" ||
      r === "viewer" ||
      r === "trial_user"
    )
      return r;
    return ident.identity.isInternal ? "customer_owner" : "viewer";
  }, [ident]);

  const sampleOnly = role === "trial_user";

  function setFilters(patch: Partial<AnalyticsFilters>) {
    setFiltersState((f) => ({ ...f, ...patch }));
  }

  async function load() {
    if (ident.status !== "ready") return;
    if (sampleOnly) {
      // Trial users never load real tenant data — the page shows the sample
      // overlay instead. We still resolve the membership for display purposes.
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: memberships, error: memErr } = await supabase
        .from("portal_user_org_memberships")
        .select("org_id")
        .eq("user_id", ident.identity.userId)
        .limit(1);
      if (memErr) throw memErr;
      const _orgId = memberships?.[0]?.org_id ?? null;
      setOrgId(_orgId);

      if (!_orgId) {
        setLoading(false);
        return;
      }

      const fromIso = filters.from;
      const toIso = filters.to;
      const periodMs =
        new Date(filters.to).getTime() - new Date(filters.from).getTime();
      const prevFromIso = new Date(
        new Date(filters.from).getTime() - periodMs
      ).toISOString();
      const prevToIso = filters.from;

      const callSelect =
        "id, org_id, location_id, phone_number_id, agent_id, started_at, ended_at, duration_sec, outcome, ai_resolved, transferred_to_human, created_at";

      // Build the base scoped queries — RLS already restricts to org_id, but
      // we layer explicit filters for performance + clarity.
      let curCallsQ = supabase
        .from("portal_calls")
        .select(callSelect)
        .eq("org_id", _orgId)
        .gte("created_at", fromIso)
        .lt("created_at", toIso);
      let prevCallsQ = supabase
        .from("portal_calls")
        .select(callSelect)
        .eq("org_id", _orgId)
        .gte("created_at", prevFromIso)
        .lt("created_at", prevToIso);
      let leadsQ = supabase
        .from("portal_leads")
        .select(
          "id, org_id, location_id, lead_score, quote_status, created_at"
        )
        .eq("org_id", _orgId)
        .gte("created_at", fromIso)
        .lt("created_at", toIso);

      if (filters.locationId !== "all") {
        curCallsQ = curCallsQ.eq("location_id", filters.locationId);
        prevCallsQ = prevCallsQ.eq("location_id", filters.locationId);
        leadsQ = leadsQ.eq("location_id", filters.locationId);
      }
      if (filters.phoneNumberId !== "all") {
        curCallsQ = curCallsQ.eq("phone_number_id", filters.phoneNumberId);
        prevCallsQ = prevCallsQ.eq("phone_number_id", filters.phoneNumberId);
      }

      const [orgRes, locsRes, numsRes, curRes, prevRes, leadsRes] =
        await Promise.all([
          supabase
            .from("portal_organizations")
            .select("name, savings_per_call")
            .eq("id", _orgId)
            .maybeSingle(),
          supabase.from("portal_locations").select("id, name").order("name"),
          supabase
            .from("portal_phone_numbers")
            .select("id, number, friendly_name, location_id"),
          curCallsQ.limit(5000),
          prevCallsQ.limit(5000),
          leadsQ.limit(5000),
        ]);

      if (orgRes.error) throw orgRes.error;
      if (locsRes.error) throw locsRes.error;
      if (numsRes.error) throw numsRes.error;
      if (curRes.error) throw curRes.error;
      if (prevRes.error) throw prevRes.error;
      if (leadsRes.error) throw leadsRes.error;

      setOrgName(orgRes.data?.name ?? null);
      setSavingsPerCall(Number(orgRes.data?.savings_per_call ?? 15));
      setLocations(
        (locsRes.data ?? []).map((l) => ({ id: l.id, name: l.name }))
      );
      setAllNumbers(
        (numsRes.data ?? []).map((n) => ({
          id: n.id,
          number: n.number,
          friendly_name: n.friendly_name,
          location_id: n.location_id,
        }))
      );
      setCalls((curRes.data ?? []) as CallRow[]);
      setPrevCalls((prevRes.data ?? []) as CallRow[]);
      setLeads((leadsRes.data ?? []) as LeadRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ident.status,
    ident.status === "ready" ? ident.identity.userId : null,
    filters.from,
    filters.to,
    filters.locationId,
    filters.phoneNumberId,
  ]);

  // Reset phone-number filter when location filter changes & current selection
  // is incompatible.
  useEffect(() => {
    if (
      filters.phoneNumberId !== "all" &&
      filters.locationId !== "all" &&
      !allNumbers.some(
        (n) => n.id === filters.phoneNumberId && n.location_id === filters.locationId
      )
    ) {
      setFiltersState((f) => ({ ...f, phoneNumberId: "all" }));
    }
  }, [filters.locationId, filters.phoneNumberId, allNumbers]);

  const numbers = useMemo(() => {
    if (filters.locationId === "all") return allNumbers;
    return allNumbers.filter((n) => n.location_id === filters.locationId);
  }, [allNumbers, filters.locationId]);

  const kpis = useMemo(() => computeKpis(calls, leads, savingsPerCall), [
    calls,
    leads,
    savingsPerCall,
  ]);
  const prevKpis = useMemo(
    () => computeKpis(prevCalls, [], savingsPerCall),
    [prevCalls, savingsPerCall]
  );

  const daily = useMemo(
    () => computeDaily(calls, savingsPerCall, filters.from, filters.to),
    [calls, savingsPerCall, filters.from, filters.to]
  );
  const outcomes = useMemo(() => computeOutcomes(calls), [calls]);

  const locationPerformance = useMemo(
    () => computeLocationPerformance(calls, locations, savingsPerCall),
    [calls, locations, savingsPerCall]
  );
  const numberPerformance = useMemo(
    () => computeNumberPerformance(calls, allNumbers, locations),
    [calls, allNumbers, locations]
  );

  return {
    loading,
    error,
    role,
    sampleOnly,
    orgId,
    orgName,
    savingsPerCall,
    locations,
    numbers,
    filters,
    setFilters,
    kpis,
    prevKpis,
    daily,
    outcomes,
    locationPerformance,
    numberPerformance,
    rawCalls: calls,
    rawLeads: leads,
    refresh: load,
  };
}

function computeKpis(
  calls: CallRow[],
  leads: LeadRow[],
  savingsPerCall: number
): AnalyticsKPIs {
  if (calls.length === 0 && leads.length === 0) return EMPTY_KPIS;
  const totalCalls = calls.length;
  const resolved = calls.filter((c) => c.ai_resolved).length;
  const transferred = calls.filter((c) => c.transferred_to_human).length;
  const handleTimes = calls
    .map((c) => c.duration_sec ?? 0)
    .filter((n) => n > 0);
  const avg =
    handleTimes.length > 0
      ? Math.round(handleTimes.reduce((a, b) => a + b, 0) / handleTimes.length)
      : 0;
  return {
    totalCalls,
    resolvedCalls: resolved,
    resolutionRate: totalCalls > 0 ? resolved / totalCalls : 0,
    avgHandleTimeSec: avg,
    transferredToHuman: transferred,
    transferRate: totalCalls > 0 ? transferred / totalCalls : 0,
    totalSavings: resolved * savingsPerCall,
    totalLeads: leads.length,
    qualifiedLeads: leads.filter((l) => (l.lead_score ?? 0) >= 70).length,
  };
}

function computeDaily(
  calls: CallRow[],
  savingsPerCall: number,
  fromIso: string,
  toIso: string
): DailyPoint[] {
  const start = new Date(fromIso);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(toIso);
  end.setUTCHours(0, 0, 0, 0);

  const map = new Map<string, { calls: number; resolved: number }>();
  // Pre-fill so the chart shows continuous days.
  for (
    let d = new Date(start);
    d <= end;
    d = new Date(d.getTime() + 86400000)
  ) {
    map.set(d.toISOString().slice(0, 10), { calls: 0, resolved: 0 });
  }
  for (const c of calls) {
    const key = (c.started_at ?? c.created_at).slice(0, 10);
    const cur = map.get(key) ?? { calls: 0, resolved: 0 };
    cur.calls += 1;
    if (c.ai_resolved) cur.resolved += 1;
    map.set(key, cur);
  }
  const sorted = [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  let cum = 0;
  return sorted.map(([date, v]) => {
    const dailySavings = v.resolved * savingsPerCall;
    cum += dailySavings;
    return {
      date,
      calls: v.calls,
      resolved: v.resolved,
      savings: dailySavings,
      cumulativeSavings: cum,
    };
  });
}

function computeOutcomes(calls: CallRow[]): OutcomeSlice[] {
  const buckets = new Map<string, number>();
  for (const c of calls) {
    let key = "Other";
    if (c.ai_resolved) key = "AI Resolved";
    else if (c.transferred_to_human) key = "Transferred";
    else if (c.outcome) {
      key = c.outcome.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    } else key = "Unresolved";
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function computeLocationPerformance(
  calls: CallRow[],
  locations: { id: string; name: string }[],
  savingsPerCall: number
): LocationPerformance[] {
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const buckets = new Map<
    string,
    { calls: number; resolved: number; durationSum: number; durationN: number }
  >();
  for (const c of calls) {
    const cur = buckets.get(c.location_id) ?? {
      calls: 0,
      resolved: 0,
      durationSum: 0,
      durationN: 0,
    };
    cur.calls += 1;
    if (c.ai_resolved) cur.resolved += 1;
    if (c.duration_sec && c.duration_sec > 0) {
      cur.durationSum += c.duration_sec;
      cur.durationN += 1;
    }
    buckets.set(c.location_id, cur);
  }
  return [...buckets.entries()]
    .map(([location_id, v]) => ({
      location_id,
      location_name: locName.get(location_id) ?? "Unassigned",
      calls: v.calls,
      resolved: v.resolved,
      resolutionRate: v.calls > 0 ? v.resolved / v.calls : 0,
      savings: v.resolved * savingsPerCall,
      avgHandleTimeSec:
        v.durationN > 0 ? Math.round(v.durationSum / v.durationN) : 0,
    }))
    .sort((a, b) => b.calls - a.calls);
}

function computeNumberPerformance(
  calls: CallRow[],
  numbers: { id: string; number: string; friendly_name: string | null; location_id: string | null }[],
  locations: { id: string; name: string }[]
): NumberPerformance[] {
  const numMap = new Map(numbers.map((n) => [n.id, n]));
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const buckets = new Map<string, { calls: number; resolved: number }>();
  for (const c of calls) {
    const cur = buckets.get(c.phone_number_id) ?? { calls: 0, resolved: 0 };
    cur.calls += 1;
    if (c.ai_resolved) cur.resolved += 1;
    buckets.set(c.phone_number_id, cur);
  }
  return [...buckets.entries()]
    .map(([phone_number_id, v]) => {
      const n = numMap.get(phone_number_id);
      return {
        phone_number_id,
        number: n?.number ?? "Unknown",
        friendly_name: n?.friendly_name ?? null,
        location_name: n?.location_id ? locName.get(n.location_id) ?? null : null,
        calls: v.calls,
        resolved: v.resolved,
        resolutionRate: v.calls > 0 ? v.resolved / v.calls : 0,
      };
    })
    .sort((a, b) => b.calls - a.calls);
}

export function analyticsCapabilities(role: AnalyticsRole) {
  return {
    canRead: role !== "none",
    canExport:
      role === "customer_owner" ||
      role === "customer_admin" ||
      role === "location_manager",
    sampleOnly: role === "trial_user",
  };
}
