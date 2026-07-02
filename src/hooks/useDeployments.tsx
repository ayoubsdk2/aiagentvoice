import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/hooks/useIdentity";

export type DeploymentRole =
  | "customer_owner"
  | "customer_admin"
  | "location_manager"
  | "viewer"
  | "trial_user"
  | "none";

export interface DeploymentRow {
  id: string;
  number: string;
  friendly_name: string | null;
  org_id: string;
  location_id: string | null;
  location_name: string | null;
  vapi_assistant_id: string | null;
  carrier: string | null;
  status: string;
  assigned_agent_id: string | null;
  agent_name: string | null;
  agent_voice_provider: string | null;
  agent_voice_id: string | null;
  agent_status: string | null;
  /** 0–100 derived health score. */
  health: number;
  crm_status: "Connected" | "Not connected";
  erp_status: "Connected" | "Not connected";
  updated_at: string;
}

interface State {
  loading: boolean;
  error: string | null;
  rows: DeploymentRow[];
  /** All locations the user can see — used as filter chips. */
  locations: { id: string; name: string }[];
  agents: { id: string; name: string; voice_provider: string | null; voice_id: string | null; status: string }[];
  role: DeploymentRole;
  /** Single org the customer belongs to (most customers have one org). */
  orgId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads all phone-number deployments the current customer is allowed to see,
 * already joined with location + agent + integration status.
 *
 * Security model:
 *   - RLS on portal_phone_numbers / portal_locations / portal_ai_agents
 *     guarantees org + location scope server-side.
 *   - Internal operators bypass via is_internal_operator() and see all rows.
 *   - The UI never tries to relax that scope; we just present what the DB returns.
 */
export function useDeployments(): State {
  const ident = useIdentity();
  const [rows, setRows] = useState<DeploymentRow[]>([]);
  const [locations, setLocations] = useState<State["locations"]>([]);
  const [agents, setAgents] = useState<State["agents"]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const role: DeploymentRole = useMemo(() => {
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
    // Internal operators viewing the customer portal still get full power.
    return ident.identity.isInternal ? "customer_owner" : "viewer";
  }, [ident]);

  async function load() {
    if (ident.status !== "ready") return;
    setLoading(true);
    setError(null);
    try {
      // Pull org membership for this user (customers usually belong to one org).
      const { data: memberships, error: memErr } = await supabase
        .from("portal_user_org_memberships")
        .select("org_id")
        .eq("user_id", ident.identity.userId)
        .limit(1);
      if (memErr) throw memErr;
      const _orgId = memberships?.[0]?.org_id ?? null;
      setOrgId(_orgId);

      // RLS will filter these to permitted rows automatically.
      const [phonesRes, locsRes, agentsRes, integrationsRes] = await Promise.all([
        supabase
          .from("portal_phone_numbers")
          .select(
            "id, number, friendly_name, org_id, location_id, vapi_assistant_id, carrier, status, assigned_agent_id, updated_at"
          )
          .order("updated_at", { ascending: false }),
        supabase.from("portal_locations").select("id, name").order("name"),
        supabase
          .from("portal_ai_agents")
          .select("id, name, voice_provider, voice_id, status")
          .order("name"),
        supabase
          .from("portal_tenant_integrations")
          .select("integration_type, status"),
      ]);

      if (phonesRes.error) throw phonesRes.error;
      if (locsRes.error) throw locsRes.error;
      if (agentsRes.error) throw agentsRes.error;

      const locMap = new Map(locsRes.data?.map((l) => [l.id, l.name]) ?? []);
      const agentMap = new Map(agentsRes.data?.map((a) => [a.id, a]) ?? []);

      const integrations = integrationsRes.data ?? [];
      const crmConnected = integrations.some(
        (i) =>
          ["salesforce", "hubspot", "zoho", "crm"].includes(
            String(i.integration_type).toLowerCase()
          ) && String(i.status).toLowerCase() === "connected"
      );
      const erpConnected = integrations.some(
        (i) =>
          ["sharp_odms", "quickbooks", "netsuite", "erp"].includes(
            String(i.integration_type).toLowerCase()
          ) && String(i.status).toLowerCase() === "connected"
      );

      const composed: DeploymentRow[] = (phonesRes.data ?? []).map((p) => {
        const agent = p.assigned_agent_id ? agentMap.get(p.assigned_agent_id) : null;
        const health = computeHealth({
          status: p.status,
          hasAssistant: Boolean(p.vapi_assistant_id),
          hasAgent: Boolean(p.assigned_agent_id),
          crmConnected,
          erpConnected,
        });
        return {
          id: p.id,
          number: p.number,
          friendly_name: p.friendly_name,
          org_id: p.org_id,
          location_id: p.location_id,
          location_name: p.location_id ? locMap.get(p.location_id) ?? null : null,
          vapi_assistant_id: p.vapi_assistant_id,
          carrier: p.carrier,
          status: p.status,
          assigned_agent_id: p.assigned_agent_id,
          agent_name: agent?.name ?? null,
          agent_voice_provider: agent?.voice_provider ?? null,
          agent_voice_id: agent?.voice_id ?? null,
          agent_status: agent?.status ?? null,
          health,
          crm_status: crmConnected ? "Connected" : "Not connected",
          erp_status: erpConnected ? "Connected" : "Not connected",
          updated_at: p.updated_at,
        };
      });

      setRows(composed);
      setLocations(
        (locsRes.data ?? []).map((l) => ({ id: l.id, name: l.name }))
      );
      setAgents(
        (agentsRes.data ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          voice_provider: a.voice_provider,
          voice_id: a.voice_id,
          status: a.status,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deployments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ident.status, ident.status === "ready" ? ident.identity.userId : null]);

  return { loading, error, rows, locations, agents, role, orgId, refresh: load };
}

function computeHealth(input: {
  status: string;
  hasAssistant: boolean;
  hasAgent: boolean;
  crmConnected: boolean;
  erpConnected: boolean;
}): number {
  let score = 0;
  if (input.status === "active") score += 40;
  else if (input.status === "provisioning") score += 20;
  if (input.hasAssistant) score += 20;
  if (input.hasAgent) score += 20;
  if (input.crmConnected) score += 10;
  if (input.erpConnected) score += 10;
  return Math.min(100, score);
}

/** Capability matrix for role-aware UI gating. */
export function deploymentCapabilities(role: DeploymentRole) {
  const isOwner = role === "customer_owner";
  const isAdmin = role === "customer_admin";
  const isManager = role === "location_manager";
  const canRead = role !== "none";
  const canEdit = isOwner || isAdmin || isManager;
  const canCreate = isOwner || isAdmin;
  const canDelete = isOwner;
  const canBulk = isOwner || isAdmin;
  const canImport = isOwner || isAdmin;
  return {
    canRead,
    canEdit,
    canCreate,
    canDelete,
    canBulk,
    canImport,
    /** Trial users get redirected to the sample dashboard rather than the live page. */
    redirectToSample: role === "trial_user",
  };
}

/** Append-only audit log entry (RLS allows members to insert into their org). */
export async function logDeploymentAudit(input: {
  orgId: string;
  locationId?: string | null;
  eventType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from("portal_audit_events").insert([
      {
        org_id: input.orgId,
        location_id: input.locationId ?? null,
        event_type: input.eventType,
        event_scope: "deployments",
        resource_type: "phone_number",
        resource_id: input.resourceId ?? null,
        metadata: (input.metadata ?? {}) as never,
      },
    ]);
  } catch {
    // Audit failure must never block the user-facing action.
  }
}
