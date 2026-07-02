import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/hooks/useIdentity";

export type LocationRole =
  | "customer_owner"
  | "customer_admin"
  | "location_manager"
  | "viewer"
  | "trial_user"
  | "none";

export type LocationStatus = "active" | "paused" | "inactive";

export interface BusinessHoursDay {
  open: string; // "09:00"
  close: string; // "17:00"
  closed?: boolean;
}
export interface BusinessHours {
  monday?: BusinessHoursDay;
  tuesday?: BusinessHoursDay;
  wednesday?: BusinessHoursDay;
  thursday?: BusinessHoursDay;
  friday?: BusinessHoursDay;
  saturday?: BusinessHoursDay;
  sunday?: BusinessHoursDay;
  holidays?: string[]; // ISO dates
}

export interface RoutingRules {
  default_intent?: string;
  escalation_phone?: string | null;
  escalation_email?: string | null;
  after_hours_action?: "voicemail" | "forward" | "callback";
  after_hours_target?: string | null;
  vip_numbers?: string[];
}

export interface LocationAddress {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
}

export interface LocationRow {
  id: string;
  org_id: string;
  name: string;
  address: LocationAddress;
  timezone: string;
  business_hours: BusinessHours;
  routing_rules: RoutingRules;
  status: LocationStatus;
  created_at: string;
  updated_at: string;
  // derived
  phone_count: number;
  active_phone_count: number;
  call_count_30d: number;
  lead_count_30d: number;
  integration_overrides: number;
  can_manage: boolean;
}

interface State {
  loading: boolean;
  error: string | null;
  rows: LocationRow[];
  role: LocationRole;
  orgId: string | null;
  /** Permission map: locationId -> {can_view, can_manage} for location_manager */
  scopedPermissions: Map<string, { can_view: boolean; can_manage: boolean }>;
  refresh: () => Promise<void>;
}

export function useLocations(): State {
  const ident = useIdentity();
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [scopedPermissions, setScopedPermissions] = useState<
    Map<string, { can_view: boolean; can_manage: boolean }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const role: LocationRole = useMemo(() => {
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

  async function load() {
    if (ident.status !== "ready") return;
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

      // RLS scopes everything to org members; location managers get the same
      // SELECT but their UPDATE rights are still owner/admin only (RLS), so we
      // read the explicit per-location permission table to gate UI controls.
      const [locsRes, phonesRes, permsRes, locIntRes] = await Promise.all([
        supabase
          .from("portal_locations")
          .select(
            "id, org_id, name, address, timezone, business_hours, routing_rules, status, created_at, updated_at"
          )
          .order("name"),
        supabase
          .from("portal_phone_numbers")
          .select("id, location_id, status"),
        supabase
          .from("portal_user_location_permissions")
          .select("location_id, can_view, can_edit")
          .eq("user_id", ident.identity.userId),
        supabase
          .from("portal_location_integrations")
          .select("location_id"),
      ]);

      if (locsRes.error) throw locsRes.error;
      if (phonesRes.error) throw phonesRes.error;

      const phoneByLoc = new Map<string, { total: number; active: number }>();
      (phonesRes.data ?? []).forEach((p) => {
        if (!p.location_id) return;
        const cur = phoneByLoc.get(p.location_id) ?? { total: 0, active: 0 };
        cur.total += 1;
        if (String(p.status).toLowerCase() === "active") cur.active += 1;
        phoneByLoc.set(p.location_id, cur);
      });

      const intByLoc = new Map<string, number>();
      (locIntRes.data ?? []).forEach((r) => {
        if (!r.location_id) return;
        intByLoc.set(r.location_id, (intByLoc.get(r.location_id) ?? 0) + 1);
      });

      const permMap = new Map<
        string,
        { can_view: boolean; can_manage: boolean }
      >();
      (permsRes.data ?? []).forEach((p) =>
        permMap.set(p.location_id, {
          can_view: Boolean(p.can_view),
          can_manage: Boolean(p.can_edit),
        })
      );
      setScopedPermissions(permMap);

      // Pull last-30-day call/lead counts (RLS scoped). Aggregate client-side
      // because we expect <500 locations per tenant in v1.
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [callsRes, leadsRes] = await Promise.all([
        supabase
          .from("portal_calls")
          .select("location_id")
          .gte("created_at", since),
        supabase
          .from("portal_leads")
          .select("location_id")
          .gte("created_at", since),
      ]);

      const callsByLoc = new Map<string, number>();
      (callsRes.data ?? []).forEach((c) => {
        if (!c.location_id) return;
        callsByLoc.set(c.location_id, (callsByLoc.get(c.location_id) ?? 0) + 1);
      });
      const leadsByLoc = new Map<string, number>();
      (leadsRes.data ?? []).forEach((l) => {
        if (!l.location_id) return;
        leadsByLoc.set(l.location_id, (leadsByLoc.get(l.location_id) ?? 0) + 1);
      });

      const composed: LocationRow[] = (locsRes.data ?? []).map((l) => {
        const phones = phoneByLoc.get(l.id) ?? { total: 0, active: 0 };
        const baseline =
          role === "customer_owner" ||
          role === "customer_admin" ||
          ident.identity.isInternal;
        const scoped = permMap.get(l.id);
        const can_manage =
          baseline ||
          (role === "location_manager" && Boolean(scoped?.can_manage));
        return {
          id: l.id,
          org_id: l.org_id,
          name: l.name,
          address: (l.address ?? {}) as LocationAddress,
          timezone: l.timezone,
          business_hours: (l.business_hours ?? {}) as BusinessHours,
          routing_rules: (l.routing_rules ?? {}) as RoutingRules,
          status: l.status as LocationStatus,
          created_at: l.created_at,
          updated_at: l.updated_at,
          phone_count: phones.total,
          active_phone_count: phones.active,
          call_count_30d: callsByLoc.get(l.id) ?? 0,
          lead_count_30d: leadsByLoc.get(l.id) ?? 0,
          integration_overrides: intByLoc.get(l.id) ?? 0,
          can_manage,
        };
      });

      // For location_manager role, hide rows they cannot view at all.
      const filtered =
        role === "location_manager"
          ? composed.filter(
              (r) => permMap.get(r.id)?.can_view !== false || permMap.has(r.id)
            )
          : composed;

      setRows(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load locations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ident.status, ident.status === "ready" ? ident.identity.userId : null]);

  return { loading, error, rows, role, orgId, scopedPermissions, refresh: load };
}

export function locationCapabilities(role: LocationRole) {
  const isOwner = role === "customer_owner";
  const isAdmin = role === "customer_admin";
  const isManager = role === "location_manager";
  return {
    canRead: role !== "none",
    canCreate: isOwner || isAdmin,
    canEditAny: isOwner || isAdmin,
    canEditScoped: isManager, // manager edit gated per-row by can_manage
    canDelete: isOwner,
    canBulk: isOwner || isAdmin,
    canApplyTemplate: isOwner || isAdmin,
    redirectToSample: role === "trial_user",
  };
}

export async function logLocationAudit(input: {
  orgId: string;
  locationId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from("portal_audit_events").insert([
      {
        org_id: input.orgId,
        location_id: input.locationId ?? null,
        event_type: input.eventType,
        event_scope: "locations",
        resource_type: "location",
        resource_id: input.locationId ?? null,
        metadata: (input.metadata ?? {}) as never,
      },
    ]);
  } catch {
    /* audit failure must never block the user */
  }
}

/** IANA-ish timezone list — common US + global options for the picker. */
export const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Mountain - no DST (Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "America/Toronto", label: "Eastern (Toronto)" },
  { value: "America/Mexico_City", label: "Central (Mexico City)" },
  { value: "Europe/London", label: "UK (London)" },
  { value: "Europe/Paris", label: "Central Europe (Paris)" },
  { value: "Asia/Tokyo", label: "Japan (Tokyo)" },
  { value: "Australia/Sydney", label: "Australia (Sydney)" },
];

export const LOCATION_TEMPLATES = [
  {
    id: "retail_branch",
    name: "Retail Branch",
    description: "Mon–Sat 9–6, voicemail after hours, in-store sales escalation.",
    timezone: "America/New_York",
    business_hours: defaultHours({ open: "09:00", close: "18:00", saturdayOpen: true, sundayClosed: true }),
    routing_rules: {
      default_intent: "sales_inquiry",
      after_hours_action: "voicemail" as const,
      after_hours_target: null,
      escalation_phone: null,
      escalation_email: null,
    },
  },
  {
    id: "service_center",
    name: "Service & Support Center",
    description: "Mon–Fri 7–7, 24/7 emergency forwarding, technician escalation.",
    timezone: "America/New_York",
    business_hours: defaultHours({ open: "07:00", close: "19:00", saturdayOpen: false, sundayClosed: true }),
    routing_rules: {
      default_intent: "service_request",
      after_hours_action: "forward" as const,
      after_hours_target: null,
      escalation_phone: null,
      escalation_email: null,
    },
  },
  {
    id: "dealership",
    name: "Dealership",
    description: "Mon–Sat 8–8, parts/service split, callback after hours.",
    timezone: "America/New_York",
    business_hours: defaultHours({ open: "08:00", close: "20:00", saturdayOpen: true, sundayClosed: true }),
    routing_rules: {
      default_intent: "general_inquiry",
      after_hours_action: "callback" as const,
      after_hours_target: null,
      escalation_phone: null,
      escalation_email: null,
    },
  },
  {
    id: "corporate_hq",
    name: "Corporate HQ",
    description: "Mon–Fri 9–5, executive routing, voicemail after hours.",
    timezone: "America/New_York",
    business_hours: defaultHours({ open: "09:00", close: "17:00", saturdayOpen: false, sundayClosed: true }),
    routing_rules: {
      default_intent: "general_inquiry",
      after_hours_action: "voicemail" as const,
      after_hours_target: null,
      escalation_phone: null,
      escalation_email: null,
    },
  },
];

function defaultHours(opts: {
  open: string;
  close: string;
  saturdayOpen: boolean;
  sundayClosed: boolean;
}): BusinessHours {
  const weekday = { open: opts.open, close: opts.close };
  return {
    monday: weekday,
    tuesday: weekday,
    wednesday: weekday,
    thursday: weekday,
    friday: weekday,
    saturday: opts.saturdayOpen ? weekday : { open: opts.open, close: opts.close, closed: true },
    sunday: { open: opts.open, close: opts.close, closed: opts.sundayClosed },
    holidays: [],
  };
}
