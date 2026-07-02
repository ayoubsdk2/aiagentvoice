import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity, type PortalPlatformRole } from "@/hooks/useIdentity";

export type CallsRole = PortalPlatformRole | "none";

export interface CallRow {
  id: string;
  org_id: string;
  location_id: string;
  location_name?: string | null;
  phone_number_id: string;
  phone_e164?: string | null;
  agent_id: string | null;
  agent_name?: string | null;
  caller_phone: string | null;
  caller_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  outcome: string | null;
  ai_resolved: boolean;
  transferred_to_human: boolean;
  recording_url: string | null;
  metadata: Record<string, any>;
  // searchable metadata pulled from transcripts table
  intent?: string | null;
  serial_number?: string | null;
  equipment_id?: string | null;
  error_code?: string | null;
  technician_name?: string | null;
  crm_match?: string | null;
}

export interface TranscriptSegment {
  ts?: number;
  speaker?: "agent" | "caller" | "system" | "tool";
  text: string;
  tool?: { name: string; args?: any; result?: any };
}

export interface TranscriptDetail {
  id: string;
  call_id: string;
  transcript_text: string | null;
  segments: TranscriptSegment[];
  searchable_metadata: Record<string, any>;
}

export interface CallsFilters {
  q: string;
  locationId: string | "all";
  outcome: string | "all";
  resolution: "all" | "ai" | "human";
  range: "24h" | "7d" | "30d" | "90d" | "all";
}

export const DEFAULT_FILTERS: CallsFilters = {
  q: "",
  locationId: "all",
  outcome: "all",
  resolution: "all",
  range: "30d",
};

export function callsCapabilities(role: CallsRole) {
  return {
    canRead: role !== "none",
    canExport: ["customer_owner", "customer_admin", "location_manager"].includes(role),
    canViewRawTools: ["customer_owner", "customer_admin"].includes(role),
    maskPII: role === "viewer",
    sampleOnly: role === "trial_user" || role === "none",
  };
}

function rangeToFromIso(range: CallsFilters["range"]): string | null {
  if (range === "all") return null;
  const ms =
    range === "24h" ? 86400_000 :
    range === "7d" ? 7 * 86400_000 :
    range === "30d" ? 30 * 86400_000 :
    90 * 86400_000;
  return new Date(Date.now() - ms).toISOString();
}

interface UseCustomerCallsResult {
  loading: boolean;
  error: string | null;
  role: CallsRole;
  caps: ReturnType<typeof callsCapabilities>;
  calls: CallRow[];
  locations: Array<{ id: string; name: string }>;
  outcomes: string[];
  filters: CallsFilters;
  setFilters: (f: Partial<CallsFilters>) => void;
  resetFilters: () => void;
  refetch: () => Promise<void>;
  fetchTranscript: (callId: string) => Promise<TranscriptDetail | null>;
  logExport: (kind: string, count: number) => Promise<void>;
  logSensitiveView: (callId: string) => Promise<void>;
  orgId: string | null;
}

export function useCustomerCalls(initialFilters?: Partial<CallsFilters>): UseCustomerCallsResult {
  const idState = useIdentity();
  const role: CallsRole = idState.status === "ready" ? (idState.identity.platformRole ?? "none") : "none";
  const caps = useMemo(() => callsCapabilities(role), [role]);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [allowedLocationIds, setAllowedLocationIds] = useState<string[] | null>(null); // null = all in org
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFiltersState] = useState<CallsFilters>({
    ...DEFAULT_FILTERS,
    ...(initialFilters ?? {}),
  });

  const setFilters = useCallback((patch: Partial<CallsFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);
  const resetFilters = useCallback(() => setFiltersState(DEFAULT_FILTERS), []);

  // Resolve org + location scope for current user
  useEffect(() => {
    let cancelled = false;
    if (idState.status !== "ready") return;
    if (caps.sampleOnly) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // Find user's first org membership
        const { data: mem, error: memErr } = await supabase
          .from("portal_user_org_memberships")
          .select("org_id, role")
          .eq("user_id", idState.identity.userId)
          .limit(1)
          .maybeSingle();

        if (memErr) throw memErr;
        if (!mem) {
          if (!cancelled) {
            setOrgId(null);
            setLoading(false);
          }
          return;
        }

        if (cancelled) return;
        setOrgId(mem.org_id);

        // Location scoping for location_manager
        if (role === "location_manager") {
          const { data: perms } = await supabase
            .from("portal_user_location_permissions")
            .select("location_id, can_view")
            .eq("user_id", idState.identity.userId);
          const ids = (perms ?? []).filter((p) => p.can_view).map((p) => p.location_id);
          if (!cancelled) setAllowedLocationIds(ids);
        } else {
          if (!cancelled) setAllowedLocationIds(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to resolve tenant scope");
      }
    })();

    return () => { cancelled = true; };
  }, [idState.status, role, caps.sampleOnly]);

  const fetchAll = useCallback(async () => {
    if (caps.sampleOnly) { setLoading(false); return; }
    if (!orgId) return;
    setLoading(true);
    setError(null);

    try {
      // Locations
      let locQuery = supabase
        .from("portal_locations")
        .select("id, name")
        .eq("org_id", orgId)
        .order("name");
      if (allowedLocationIds && allowedLocationIds.length > 0) {
        locQuery = locQuery.in("id", allowedLocationIds);
      } else if (allowedLocationIds && allowedLocationIds.length === 0) {
        // location_manager with no permissions
        setLocations([]);
        setCalls([]);
        setLoading(false);
        return;
      }
      const { data: locs } = await locQuery;
      setLocations((locs ?? []).map((l) => ({ id: l.id, name: l.name })));

      // Calls
      let q = supabase
        .from("portal_calls")
        .select("*")
        .eq("org_id", orgId)
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(500);

      const fromIso = rangeToFromIso(filters.range);
      if (fromIso) q = q.gte("started_at", fromIso);
      if (filters.locationId !== "all") q = q.eq("location_id", filters.locationId);
      if (filters.outcome !== "all") q = q.eq("outcome", filters.outcome);
      if (filters.resolution === "ai") q = q.eq("ai_resolved", true);
      if (filters.resolution === "human") q = q.eq("transferred_to_human", true);
      if (allowedLocationIds && allowedLocationIds.length > 0) {
        q = q.in("location_id", allowedLocationIds);
      }

      const { data: callRows, error: callErr } = await q;
      if (callErr) throw callErr;

      // Hydrate searchable metadata + agent/phone names
      const ids = (callRows ?? []).map((c) => c.id);
      const [{ data: tx }, { data: agents }, { data: phones }] = await Promise.all([
        ids.length
          ? supabase.from("portal_call_transcripts").select("call_id, searchable_metadata").in("call_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("portal_ai_agents").select("id, name").eq("org_id", orgId),
        supabase.from("portal_phone_numbers").select("id, number, friendly_name").eq("org_id", orgId),
      ]);

      const txMap = new Map((tx ?? []).map((t: any) => [t.call_id, t.searchable_metadata ?? {}]));
      const agentMap = new Map((agents ?? []).map((a: any) => [a.id, a.name]));
      const phoneMap = new Map((phones ?? []).map((p: any) => [p.id, p.friendly_name || p.number]));
      const locMap = new Map((locs ?? []).map((l) => [l.id, l.name]));

      const enriched: CallRow[] = (callRows ?? []).map((c) => {
        const m = (txMap.get(c.id) ?? {}) as Record<string, any>;
        return {
          ...c,
          metadata: (c.metadata ?? {}) as Record<string, any>,
          location_name: locMap.get(c.location_id) ?? null,
          agent_name: c.agent_id ? agentMap.get(c.agent_id) ?? null : null,
          phone_e164: phoneMap.get(c.phone_number_id) ?? null,
          intent: m.intent ?? null,
          serial_number: m.serial_number ?? null,
          equipment_id: m.equipment_id ?? null,
          error_code: m.error_code ?? null,
          technician_name: m.technician_name ?? null,
          crm_match: m.crm_match ?? null,
        };
      });

      // Free-text search filter (client side over hydrated columns)
      const ql = filters.q.trim().toLowerCase();
      const final = ql
        ? enriched.filter((c) =>
            [
              c.caller_name, c.caller_phone, c.outcome, c.location_name,
              c.agent_name, c.phone_e164, c.intent, c.serial_number,
              c.equipment_id, c.error_code, c.technician_name, c.crm_match,
            ]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(ql))
          )
        : enriched;

      setCalls(final);
    } catch (e: any) {
      setError(e.message ?? "Failed to load calls");
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, allowedLocationIds, filters, caps.sampleOnly]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const outcomes = useMemo(() => {
    const s = new Set<string>();
    calls.forEach((c) => c.outcome && s.add(c.outcome));
    return Array.from(s).sort();
  }, [calls]);

  const fetchTranscript = useCallback(async (callId: string): Promise<TranscriptDetail | null> => {
    if (caps.sampleOnly) return null;
    const { data, error: e } = await supabase
      .from("portal_call_transcripts")
      .select("id, call_id, transcript_text, searchable_metadata")
      .eq("call_id", callId)
      .maybeSingle();
    if (e || !data) return null;

    let segments: TranscriptSegment[] = [];
    try {
      const meta = data.searchable_metadata as any;
      if (Array.isArray(meta?.segments)) segments = meta.segments;
      else if (data.transcript_text) {
        segments = data.transcript_text.split("\n").filter(Boolean).map((line) => {
          const m = line.match(/^\s*(Agent|Caller|System|Tool)\s*:\s*(.*)$/i);
          if (m) return { speaker: m[1].toLowerCase() as any, text: m[2] };
          return { text: line };
        });
      }
    } catch { /* noop */ }

    return {
      id: data.id,
      call_id: data.call_id,
      transcript_text: data.transcript_text,
      searchable_metadata: (data.searchable_metadata ?? {}) as Record<string, any>,
      segments,
    };
  }, [caps.sampleOnly]);

  const logExport = useCallback(async (kind: string, count: number) => {
    if (!orgId) return;
    try {
      await supabase.from("portal_audit_events").insert([
        {
          org_id: orgId,
          event_type: `calls.export.${kind}`,
          event_scope: "calls",
          resource_type: "calls",
          metadata: { count, filters } as never,
        },
      ]);
    } catch { /* swallow */ }
  }, [orgId, filters]);

  const logSensitiveView = useCallback(async (callId: string) => {
    if (!orgId) return;
    try {
      await supabase.from("portal_audit_events").insert([
        {
          org_id: orgId,
          event_type: "calls.transcript.view",
          event_scope: "calls",
          resource_type: "call",
          resource_id: callId,
        },
      ]);
    } catch { /* swallow */ }
  }, [orgId]);

  return {
    loading,
    error,
    role,
    caps,
    calls,
    locations,
    outcomes,
    filters,
    setFilters,
    resetFilters,
    refetch: fetchAll,
    fetchTranscript,
    logExport,
    logSensitiveView,
    orgId,
  };
}

export function maskPhone(phone: string | null | undefined, mask: boolean): string {
  if (!phone) return "—";
  if (!mask) return phone;
  return phone.replace(/\d(?=\d{2})/g, "•");
}
