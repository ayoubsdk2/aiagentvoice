import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Phone,
  Plus,
  Upload,
  Search,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Power,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Sparkles,
  Lock,
  Activity,
  Bot,
  Database,
  Building2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  useDeployments,
  deploymentCapabilities,
  logDeploymentAudit,
  type DeploymentRow,
} from "@/hooks/useDeployments";
import SampleLiveDashboard from "@/components/customer-portal/SampleLiveDashboard";

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Phone number is too short")
  .max(20, "Phone number is too long")
  .regex(/^[+0-9\s().-]+$/, "Use digits, spaces, +, (), . or - only");

const friendlyNameSchema = z.string().trim().max(80).optional();

export function DeploymentsPage() {
  const { loading, error, rows, locations, agents, role, orgId, refresh } =
    useDeployments();
  const caps = deploymentCapabilities(role);

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Trial users: redirect to the sample dashboard rather than the live page.
  if (caps.redirectToSample) return <SampleLiveDashboard />;

  if (!caps.canRead) {
    return (
      <div className="glass-card p-8 text-center max-w-md mx-auto">
        <Lock className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
        <h2 className="text-base font-bold">Access required</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Ask your organization owner to grant you access to Deployments.
        </p>
      </div>
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (locationFilter !== "all" && r.location_id !== locationFilter)
        return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.number.toLowerCase().includes(q) ||
        (r.friendly_name ?? "").toLowerCase().includes(q) ||
        (r.agent_name ?? "").toLowerCase().includes(q) ||
        (r.location_name ?? "").toLowerCase().includes(q) ||
        (r.vapi_assistant_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, locationFilter, statusFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, DeploymentRow[]>();
    for (const r of filtered) {
      const key = r.location_name ?? "Unassigned";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const visibleSelectedIds = selectedIds.filter((id) =>
    filtered.some((r) => r.id === id)
  );
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selected[r.id]);

  function toggleAllVisible() {
    if (!caps.canBulk) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (allVisibleSelected) filtered.forEach((r) => delete next[r.id]);
      else filtered.forEach((r) => (next[r.id] = true));
      return next;
    });
  }

  async function handleDelete(row: DeploymentRow) {
    if (!caps.canDelete) return;
    if (!confirm(`Remove ${row.friendly_name ?? row.number}? This cannot be undone.`))
      return;
    setPendingId(row.id);
    try {
      const { error: e } = await supabase
        .from("portal_phone_numbers")
        .delete()
        .eq("id", row.id);
      if (e) throw e;
      await logDeploymentAudit({
        orgId: row.org_id,
        locationId: row.location_id,
        eventType: "deployment.deleted",
        resourceId: row.id,
        metadata: { number: row.number },
      });
      toast.success("Deployment removed");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setPendingId(null);
    }
  }

  async function handleStatus(row: DeploymentRow, next: "active" | "paused") {
    if (!caps.canEdit) return;
    setPendingId(row.id);
    // The DB enum uses `inactive` rather than `paused`; map at the boundary.
    const dbStatus: "active" | "inactive" = next === "active" ? "active" : "inactive";
    try {
      const { error: e } = await supabase
        .from("portal_phone_numbers")
        .update({ status: dbStatus })
        .eq("id", row.id);
      if (e) throw e;
      await logDeploymentAudit({
        orgId: row.org_id,
        locationId: row.location_id,
        eventType: `deployment.${next === "active" ? "activated" : "paused"}`,
        resourceId: row.id,
        metadata: { previous: row.status, next: dbStatus, number: row.number },
      });
      toast.success(next === "active" ? "Deployment activated" : "Deployment paused");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setPendingId(null);
    }
  }

  async function handleAssignAgent(row: DeploymentRow, agentId: string | null) {
    if (!caps.canEdit) return;
    setPendingId(row.id);
    try {
      const { error: e } = await supabase
        .from("portal_phone_numbers")
        .update({ assigned_agent_id: agentId })
        .eq("id", row.id);
      if (e) throw e;
      await logDeploymentAudit({
        orgId: row.org_id,
        locationId: row.location_id,
        eventType: "deployment.agent_assigned",
        resourceId: row.id,
        metadata: { previous: row.assigned_agent_id, next: agentId },
      });
      toast.success("Agent assignment updated");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setPendingId(null);
    }
  }

  async function handleBulk(action: "activate" | "pause" | "delete") {
    if (!caps.canBulk) return;
    if (visibleSelectedIds.length === 0) return;
    if (action === "delete" && !caps.canDelete) {
      toast.error("Only the organization owner can delete deployments");
      return;
    }
    if (
      action === "delete" &&
      !confirm(`Remove ${visibleSelectedIds.length} deployments?`)
    )
      return;

    try {
      if (action === "delete") {
        const { error: e } = await supabase
          .from("portal_phone_numbers")
          .delete()
          .in("id", visibleSelectedIds);
        if (e) throw e;
      } else {
        const dbStatus: "active" | "inactive" = action === "activate" ? "active" : "inactive";
        const { error: e } = await supabase
          .from("portal_phone_numbers")
          .update({ status: dbStatus })
          .in("id", visibleSelectedIds);
        if (e) throw e;
      }
      if (orgId) {
        await logDeploymentAudit({
          orgId,
          eventType: `deployment.bulk_${action}`,
          metadata: { count: visibleSelectedIds.length, ids: visibleSelectedIds },
        });
      }
      toast.success(`${visibleSelectedIds.length} deployments updated`);
      setSelected({});
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk action failed");
    }
  }

  function handleImportClick() {
    if (!caps.canImport) return;
    fileRef.current?.click();
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !orgId) return;
    try {
      const text = await file.text();
      const parsed = parseDeploymentsCsv(text);
      if (parsed.errors.length > 0) {
        toast.error(`CSV: ${parsed.errors[0]}`);
        return;
      }
      if (parsed.rows.length === 0) {
        toast.error("CSV had no valid rows");
        return;
      }
      const inserts = parsed.rows.map((r) => ({
        org_id: orgId,
        location_id: matchLocationId(r.location, locations),
        number: r.number,
        friendly_name: r.friendly_name || null,
        carrier: r.carrier || null,
        status: "provisioning" as const,
      }));
      const { error: e2 } = await supabase
        .from("portal_phone_numbers")
        .insert(inserts);
      if (e2) throw e2;
      await logDeploymentAudit({
        orgId,
        eventType: "deployment.imported_csv",
        metadata: { count: inserts.length },
      });
      toast.success(`Imported ${inserts.length} deployments`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Activity size={16} className="text-primary" /> Deployments
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage phone numbers, agent assignments, and integration health across
            every location your organization operates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge role={role} />
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border/50 bg-secondary/40 hover:bg-secondary/60 text-xs font-bold tracking-wide transition-colors"
            aria-label="Refresh deployments"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          {caps.canImport && (
            <button
              onClick={handleImportClick}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border/50 bg-secondary/40 hover:bg-secondary/60 text-xs font-bold tracking-wide transition-colors"
            >
              <Upload size={13} /> Import CSV
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
          {caps.canCreate && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold tracking-wide transition-colors"
            >
              <Plus size={13} /> Add phone number
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <SummaryStrip rows={rows} />

      {/* Toolbar */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.slice(0, 120))}
            placeholder="Search number, friendly name, agent, assistant ID…"
            className="w-full bg-secondary/50 border border-border/50 rounded-md h-9 pl-8 pr-3 text-xs focus:outline-none focus:border-primary/50"
          />
        </label>
        <FilterSelect
          label="Location"
          value={locationFilter}
          onChange={setLocationFilter}
          options={[
            { value: "all", label: "All locations" },
            ...locations.map((l) => ({ value: l.id, label: l.name })),
          ]}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "Any" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Paused" },
            { value: "provisioning", label: "Provisioning" },
            { value: "error", label: "Error" },
          ]}
        />
        {visibleSelectedIds.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] text-muted-foreground font-bold">
              {visibleSelectedIds.length} selected
            </span>
            {caps.canBulk && (
              <>
                <button
                  onClick={() => handleBulk("activate")}
                  className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/25 transition-colors"
                >
                  Activate
                </button>
                <button
                  onClick={() => handleBulk("pause")}
                  className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
                >
                  Pause
                </button>
              </>
            )}
            {caps.canDelete && (
              <button
                onClick={() => handleBulk("delete")}
                className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-2"
        >
          <ShieldAlert size={13} /> {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : grouped.length === 0 ? (
        <EmptyState canCreate={caps.canCreate} onAdd={() => setShowAdd(true)} />
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/30 text-muted-foreground">
                <tr className="text-left">
                  <th className="w-8 p-2.5">
                    {caps.canBulk && (
                      <input
                        type="checkbox"
                        aria-label="Select all visible"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        className="accent-primary"
                      />
                    )}
                  </th>
                  <th className="w-6 p-2.5"></th>
                  <th className="p-2.5 font-bold uppercase tracking-widest text-[10px]">
                    Number
                  </th>
                  <th className="p-2.5 font-bold uppercase tracking-widest text-[10px]">
                    Agent
                  </th>
                  <th className="p-2.5 font-bold uppercase tracking-widest text-[10px]">
                    Status
                  </th>
                  <th className="p-2.5 font-bold uppercase tracking-widest text-[10px]">
                    CRM
                  </th>
                  <th className="p-2.5 font-bold uppercase tracking-widest text-[10px]">
                    ERP
                  </th>
                  <th className="p-2.5 font-bold uppercase tracking-widest text-[10px]">
                    Health
                  </th>
                  <th className="p-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([loc, items]) => (
                  <LocationGroup
                    key={loc}
                    locationName={loc}
                    items={items}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    selected={selected}
                    setSelected={setSelected}
                    caps={caps}
                    agents={agents}
                    pendingId={pendingId}
                    onAssignAgent={handleAssignAgent}
                    onStatus={handleStatus}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddPhoneModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        locations={locations}
        agents={agents}
        orgId={orgId}
        canCreate={caps.canCreate}
        onCreated={refresh}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function SummaryStrip({ rows }: { rows: DeploymentRow[] }) {
  const total = rows.length;
  const active = rows.filter((r) => r.status === "active").length;
  const provisioning = rows.filter((r) => r.status === "provisioning").length;
  const avgHealth = total
    ? Math.round(rows.reduce((s, r) => s + r.health, 0) / total)
    : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat icon={<Phone size={13} />} label="Phone numbers" value={total.toString()} />
      <Stat
        icon={<CheckCircle2 size={13} />}
        label="Active"
        value={active.toString()}
        accent="text-[hsl(var(--success))]"
      />
      <Stat
        icon={<Activity size={13} />}
        label="Provisioning"
        value={provisioning.toString()}
        accent="text-amber-400"
      />
      <Stat
        icon={<Sparkles size={13} />}
        label="Avg health"
        value={`${avgHealth}%`}
        accent={
          avgHealth >= 80
            ? "text-[hsl(var(--success))]"
            : avgHealth >= 50
            ? "text-amber-400"
            : "text-destructive"
        }
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="glass-card p-3.5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] uppercase tracking-widest font-bold">
          {label}
        </span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className={`mt-1 text-xl font-bold tracking-tight ${accent ?? ""}`}>
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-secondary/40 px-2 h-9">
      <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-foreground text-xs font-semibold focus:outline-none cursor-pointer pr-1"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-background text-foreground">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    customer_owner: {
      label: "Owner · full access",
      cls: "bg-primary/15 text-primary border-primary/30",
    },
    customer_admin: {
      label: "Admin · operational",
      cls: "bg-primary/15 text-primary border-primary/30",
    },
    location_manager: {
      label: "Manager · location scope",
      cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    viewer: {
      label: "Viewer · read-only",
      cls: "bg-secondary/60 text-muted-foreground border-border/40",
    },
  };
  const m = map[role];
  if (!m) return null;
  return (
    <span
      className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

interface GroupProps {
  locationName: string;
  items: DeploymentRow[];
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  selected: Record<string, boolean>;
  setSelected: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  caps: ReturnType<typeof deploymentCapabilities>;
  agents: ReturnType<typeof useDeployments>["agents"];
  pendingId: string | null;
  onAssignAgent: (row: DeploymentRow, agentId: string | null) => void;
  onStatus: (row: DeploymentRow, next: "active" | "paused") => void;
  onDelete: (row: DeploymentRow) => void;
}

function LocationGroup(props: GroupProps) {
  const {
    locationName,
    items,
    expanded,
    setExpanded,
    selected,
    setSelected,
    caps,
    agents,
    pendingId,
    onAssignAgent,
    onStatus,
    onDelete,
  } = props;
  return (
    <>
      <tr className="bg-secondary/20 border-y border-border/40">
        <td colSpan={9} className="p-2.5">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <Building2 size={12} className="text-primary" />
            {locationName}
            <span className="text-muted-foreground/60">· {items.length}</span>
          </div>
        </td>
      </tr>
      {items.map((row) => {
        const isOpen = expanded[row.id];
        const isPending = pendingId === row.id;
        return (
          <RowGroup
            key={row.id}
            row={row}
            isOpen={isOpen}
            isPending={isPending}
            isSelected={Boolean(selected[row.id])}
            onToggleSelect={() =>
              setSelected((p) => ({ ...p, [row.id]: !p[row.id] }))
            }
            onToggleExpand={() =>
              setExpanded((p) => ({ ...p, [row.id]: !p[row.id] }))
            }
            caps={caps}
            agents={agents}
            onAssignAgent={(id) => onAssignAgent(row, id)}
            onStatus={(s) => onStatus(row, s)}
            onDelete={() => onDelete(row)}
          />
        );
      })}
    </>
  );
}

function RowGroup({
  row,
  isOpen,
  isPending,
  isSelected,
  onToggleSelect,
  onToggleExpand,
  caps,
  agents,
  onAssignAgent,
  onStatus,
  onDelete,
}: {
  row: DeploymentRow;
  isOpen: boolean;
  isPending: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  caps: ReturnType<typeof deploymentCapabilities>;
  agents: ReturnType<typeof useDeployments>["agents"];
  onAssignAgent: (id: string | null) => void;
  onStatus: (s: "active" | "paused") => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <tr className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
        <td className="p-2.5 align-middle">
          {caps.canBulk && (
            <input
              type="checkbox"
              aria-label={`Select ${row.number}`}
              checked={isSelected}
              onChange={onToggleSelect}
              className="accent-primary"
            />
          )}
        </td>
        <td className="p-2.5 align-middle">
          <button
            onClick={onToggleExpand}
            aria-label={isOpen ? "Collapse details" : "Expand details"}
            className="text-muted-foreground hover:text-foreground"
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="p-2.5 align-middle">
          <div className="font-mono font-bold text-foreground">{row.number}</div>
          {row.friendly_name && (
            <div className="text-[11px] text-muted-foreground">
              {row.friendly_name}
            </div>
          )}
        </td>
        <td className="p-2.5 align-middle">
          <div className="flex items-center gap-1.5">
            <Bot size={12} className="text-primary shrink-0" />
            <span className="font-semibold">
              {row.agent_name ?? <span className="text-muted-foreground">Unassigned</span>}
            </span>
          </div>
        </td>
        <td className="p-2.5 align-middle">
          <StatusPill status={row.status} />
        </td>
        <td className="p-2.5 align-middle">
          <IntegrationPill ok={row.crm_status === "Connected"} />
        </td>
        <td className="p-2.5 align-middle">
          <IntegrationPill ok={row.erp_status === "Connected"} />
        </td>
        <td className="p-2.5 align-middle">
          <HealthBar score={row.health} />
        </td>
        <td className="p-2.5 align-middle text-right relative">
          {(caps.canEdit || caps.canDelete) && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Row actions"
              className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary/60"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={14} />}
            </button>
          )}
          {menuOpen && (
            <div
              className="absolute right-2 top-9 z-20 w-48 rounded-lg border border-border/50 bg-popover shadow-xl py-1 text-xs"
              onMouseLeave={() => setMenuOpen(false)}
            >
              {caps.canEdit && row.status !== "active" && (
                <MenuItem
                  icon={<Power size={12} />}
                  label="Activate"
                  onClick={() => {
                    setMenuOpen(false);
                    onStatus("active");
                  }}
                />
              )}
              {caps.canEdit && row.status === "active" && (
                <MenuItem
                  icon={<Power size={12} />}
                  label="Pause"
                  onClick={() => {
                    setMenuOpen(false);
                    onStatus("paused");
                  }}
                />
              )}
              {caps.canDelete && (
                <MenuItem
                  icon={<Trash2 size={12} />}
                  label="Remove"
                  destructive
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                />
              )}
              {!caps.canEdit && !caps.canDelete && (
                <div className="px-3 py-2 text-muted-foreground">No actions</div>
              )}
            </div>
          )}
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {isOpen && (
          <tr>
            <td colSpan={9} className="bg-secondary/10 border-b border-border/40">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                  <DetailBlock title="Voice Engine">
                    <DetailRow label="Voice provider" value={row.agent_voice_provider ?? "—"} />
                    <DetailRow label="Voice ID" value={row.agent_voice_id ?? "—"} mono />
                    <DetailRow label="Agent status" value={row.agent_status ?? "—"} />
                  </DetailBlock>
                  <DetailBlock title="Telephony">
                    <DetailRow label="Carrier" value={row.carrier ?? "—"} />
                    <DetailRow
                      label="Voice agent ID"
                      value={row.vapi_assistant_id ?? "Not linked"}
                      mono
                    />
                    <DetailRow label="Updated" value={formatDate(row.updated_at)} />
                  </DetailBlock>
                  <DetailBlock title="Quick actions">
                    {caps.canEdit ? (
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                          Assigned agent
                        </span>
                        <select
                          value={row.assigned_agent_id ?? ""}
                          onChange={(e) =>
                            onAssignAgent(e.target.value ? e.target.value : null)
                          }
                          className="mt-1 w-full bg-secondary/60 border border-border/50 rounded-md h-9 px-2 text-xs"
                        >
                          <option value="">— Unassigned —</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Lock size={11} /> Read-only access
                      </p>
                    )}
                  </DetailBlock>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/60 ${
        destructive ? "text-destructive" : "text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-semibold text-right truncate ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
    inactive: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    provisioning: "bg-primary/15 text-primary border-primary/30",
    error: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${
        map[status] ?? "bg-secondary/60 text-muted-foreground border-border/40"
      }`}
    >
      {status}
    </span>
  );
}

function IntegrationPill({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[hsl(var(--success))]">
      <CheckCircle2 size={11} /> Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
      <XCircle size={11} /> Not linked
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "bg-[hsl(var(--success))]"
      : score >= 50
      ? "bg-amber-400"
      : "bg-destructive";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="h-1.5 w-16 rounded-full bg-secondary/60 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums">{score}%</span>
    </div>
  );
}

function EmptyState({
  canCreate,
  onAdd,
}: {
  canCreate: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="glass-card p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
        <Phone className="w-5 h-5 text-primary" />
      </div>
      <h3 className="mt-4 text-base font-bold">No deployments yet</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
        Add a phone number or import a CSV to start routing inbound calls to
        Phoebe and your AI agents.
      </p>
      {canCreate && (
        <button
          onClick={onAdd}
          className="mt-4 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
        >
          <Plus size={13} /> Add phone number
        </button>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="glass-card p-4 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-9 rounded-md bg-secondary/40 animate-pulse"
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add phone modal                                                            */
/* -------------------------------------------------------------------------- */

function AddPhoneModal({
  open,
  onClose,
  locations,
  agents,
  orgId,
  canCreate,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  locations: { id: string; name: string }[];
  agents: { id: string; name: string }[];
  orgId: string | null;
  canCreate: boolean;
  onCreated: () => Promise<void>;
}) {
  const [number, setNumber] = useState("");
  const [friendly, setFriendly] = useState("");
  const [carrier, setCarrier] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!canCreate) {
      setErr("Your role cannot create deployments");
      return;
    }
    if (!orgId) {
      setErr("No organization is associated with your account yet");
      return;
    }
    const numParsed = phoneSchema.safeParse(number);
    if (!numParsed.success) {
      setErr(numParsed.error.issues[0]?.message ?? "Invalid number");
      return;
    }
    const friendlyParsed = friendlyNameSchema.safeParse(friendly);
    if (!friendlyParsed.success) {
      setErr("Friendly name is too long");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: insErr } = await supabase
        .from("portal_phone_numbers")
        .insert([
          {
            org_id: orgId,
            location_id: locationId || null,
            number: numParsed.data,
            friendly_name: friendlyParsed.data || null,
            carrier: carrier.trim() || null,
            assigned_agent_id: agentId || null,
            status: "provisioning",
          },
        ])
        .select("id")
        .single();
      if (insErr) throw insErr;
      await logDeploymentAudit({
        orgId,
        locationId: locationId || null,
        eventType: "deployment.created",
        resourceId: data?.id ?? null,
        metadata: { number: numParsed.data, agent_id: agentId || null },
      });
      toast.success("Phone number added");
      setNumber("");
      setFriendly("");
      setCarrier("");
      setLocationId("");
      setAgentId("");
      onClose();
      await onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-phone-title"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 id="add-phone-title" className="text-base font-bold tracking-tight">
            Add phone number
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            New numbers start in <span className="font-bold">provisioning</span>{" "}
            until carrier checks complete.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field
            label="Phone number"
            required
            value={number}
            onChange={setNumber}
            placeholder="+1 (713) 555-0100"
            autoFocus
          />
          <Field
            label="Friendly name"
            value={friendly}
            onChange={setFriendly}
            placeholder="Houston main line"
          />
          <Field
            label="Carrier"
            value={carrier}
            onChange={setCarrier}
            placeholder="Twilio, Telnyx, …"
          />
          <SelectField
            label="Location"
            value={locationId}
            onChange={setLocationId}
            options={[
              { value: "", label: "— Unassigned —" },
              ...locations.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
          <SelectField
            label="Initial agent"
            value={agentId}
            onChange={setAgentId}
            options={[
              { value: "", label: "— Unassigned —" },
              ...agents.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
          {err && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {err}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 h-9 rounded-lg border border-border/50 text-xs font-bold hover:bg-secondary/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              Add deployment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 200))}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className="w-full bg-secondary/50 border border-border/50 rounded-md h-9 px-2.5 text-xs focus:outline-none focus:border-primary/50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-secondary/50 border border-border/50 rounded-md h-9 px-2.5 text-xs focus:outline-none focus:border-primary/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-background">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* CSV helpers                                                                */
/* -------------------------------------------------------------------------- */

interface CsvRow {
  number: string;
  friendly_name: string;
  carrier: string;
  location: string;
}

function parseDeploymentsCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], errors: ["File is empty"] };

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    number: header.indexOf("number"),
    friendly_name: header.indexOf("friendly_name"),
    carrier: header.indexOf("carrier"),
    location: header.indexOf("location"),
  };
  if (idx.number === -1) {
    errors.push("CSV must include a 'number' column");
    return { rows: [], errors };
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length && rows.length < 500; i++) {
    const cells = splitCsvLine(lines[i]);
    const number = (cells[idx.number] ?? "").trim();
    if (!number) continue;
    const parsed = phoneSchema.safeParse(number);
    if (!parsed.success) {
      errors.push(`Line ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid number"}`);
      continue;
    }
    rows.push({
      number: parsed.data,
      friendly_name: idx.friendly_name >= 0 ? (cells[idx.friendly_name] ?? "").trim().slice(0, 80) : "",
      carrier: idx.carrier >= 0 ? (cells[idx.carrier] ?? "").trim().slice(0, 60) : "",
      location: idx.location >= 0 ? (cells[idx.location] ?? "").trim() : "",
    });
  }
  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  // Minimal CSV parser supporting quoted fields and escaped quotes.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === ",") {
        out.push(cur);
        cur = "";
      } else if (c === '"') {
        inQuotes = true;
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

function matchLocationId(
  name: string,
  locations: { id: string; name: string }[]
): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  return locations.find((l) => l.name.toLowerCase() === lower)?.id ?? null;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default DeploymentsPage;
