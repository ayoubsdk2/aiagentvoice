import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminFetch } from "@/lib/admin-session";
import { Plug, Loader2, Send, KeyRound, Search, Plus } from "lucide-react";
import { HubSpotIntegrationCard } from "@/components/admin/integrations/HubSpotIntegrationCard";
import { BespokeIntegrationCard } from "@/components/admin/integrations/BespokeIntegrationCard";
import { PlatformIntegrationCard } from "@/components/admin/integrations/PlatformIntegrationsSection";
import { INTEGRATION_DEFINITIONS, type IntegrationDefinition } from "@/lib/integration-registry";

interface ActionRouterConfig {
  customer_id: string;
  endpoint_url: string | null;
  auth_secret_ref: string | null;
  retry_max: number;
  retry_backoff_seconds: number;
  manual_review_destination: string | null;
  vendor_priority: string[];
  enabled: boolean;
}

const BESPOKE_IDS = new Set(["hubspot", "sales_chain", "eautomate", "printanista"]);

export function LiveAccountIntegrationsPanel({ customerId, displayName, notificationEmail }: {
  customerId: string;
  displayName: string;
  notificationEmail: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [router, setRouter] = useState<ActionRouterConfig | null>(null);
  const [routerSaving, setRouterSaving] = useState(false);
  const [testingTestEmail, setTestingTestEmail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { config } = await adminFetch<{ config: ActionRouterConfig | null }>("admin-api", "/action-router", {
        query: { customer_id: customerId },
      });
      setRouter(config ?? {
        customer_id: customerId, endpoint_url: "", auth_secret_ref: "",
        retry_max: 3, retry_backoff_seconds: 30, manual_review_destination: "",
        vendor_priority: ["email", "integration", "portal_automation"], enabled: false,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);

  const sendTestEmail = async () => {
    setTestingTestEmail(true);
    try {
      await adminFetch("soa-alert", "/", {
        method: "POST",
        body: {
          to: notificationEmail || "daniel@phaosai.com",
          subject: `Phaos AI · SOA setup test (${displayName})`,
          html: `<p>This is a test notification from the Phaos AI SOA integrations console.</p>
                 <p>Account: <strong>${displayName}</strong></p>`,
          tag: "soa_setup_test",
        },
      });
      toast.success(`Test email queued to ${notificationEmail || "daniel@phaosai.com"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test email failed");
    } finally {
      setTestingTestEmail(false);
    }
  };

  const saveRouter = async () => {
    if (!router) return;
    setRouterSaving(true);
    try {
      await adminFetch("admin-api", "/action-router", {
        method: "PUT",
        body: { ...router, customer_id: customerId },
      });
      toast.success("Action Router config saved.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setRouterSaving(false); }
  };

  if (loading) {
    return <div className="p-6 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="animate-spin" size={14}/> Loading SOA integrations…</div>;
  }

  return (
    <div className="p-5 space-y-6 bg-secondary/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
            <Plug size={14} className="text-primary"/> SOA Integrations
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Alerts route to <span className="text-foreground font-mono">{notificationEmail || "daniel@phaosai.com"}</span>.
            Every integration is added through the search bar below. Cards only flip to ACTIVE once every element passes Test Connection.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={sendTestEmail} disabled={testingTestEmail} className="gap-1.5">
          {testingTestEmail ? <Loader2 className="animate-spin" size={12}/> : <Send size={12}/>} Send test email
        </Button>
      </div>

      {/* Search & Add Integrations */}
      <IntegrationSearchAndAdd
        customerId={customerId}
        customerDisplayName={displayName}
        notificationEmail={notificationEmail}
      />

      {/* Action Router */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-foreground flex items-center gap-2"><KeyRound size={14}/> Action Router (Render)</h4>
          <Switch
            checked={!!router?.enabled}
            onCheckedChange={(c) => router && setRouter({ ...router, enabled: c })}
            aria-label="Enable Action Router"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">All Retell tool calls go here. Vendor execution priority: email → integration → portal automation fallback.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Endpoint URL</span>
            <Input value={router?.endpoint_url ?? ""} onChange={(e) => router && setRouter({ ...router, endpoint_url: e.target.value })} placeholder="https://soa-router.onrender.com/v1/intent" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Auth secret name</span>
            <Input value={router?.auth_secret_ref ?? ""} onChange={(e) => router && setRouter({ ...router, auth_secret_ref: e.target.value })} placeholder="RENDER_ACTION_ROUTER_SECRET" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Retry max</span>
            <Input type="number" min={0} value={router?.retry_max ?? 3} onChange={(e) => router && setRouter({ ...router, retry_max: Number(e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Manual review destination</span>
            <Input value={router?.manual_review_destination ?? ""} onChange={(e) => router && setRouter({ ...router, manual_review_destination: e.target.value })} placeholder="daniel@phaosai.com" />
          </label>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveRouter} disabled={routerSaving}>{routerSaving ? "Saving…" : "Save router config"}</Button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Search & Add Integrations ─────────────────────────

interface SearchableIntegration {
  id: string;
  displayName: string;
  /** Definition is null for the bespoke HubSpot card (uses dedicated table columns). */
  def: IntegrationDefinition | null;
}

interface CredRow {
  integration_id: string;
  status: string | null;
  field_hints: Record<string, unknown> | null;
  last_tested_at: string | null;
  last_test_outcome: string | null;
  last_test_error: string | null;
  updated_at: string | null;
}

function IntegrationSearchAndAdd({
  customerId,
  customerDisplayName,
  notificationEmail,
}: {
  customerId: string;
  customerDisplayName: string;
  notificationEmail: string | null;
}) {
  const allIntegrations: SearchableIntegration[] = useMemo(() => {
    const fromRegistry = INTEGRATION_DEFINITIONS.map((d) => ({
      id: d.id, displayName: d.displayName, def: d,
    }));
    // HubSpot uses bespoke columns, others use generic per-client encryption.
    return [
      { id: "hubspot", displayName: "HubSpot", def: INTEGRATION_DEFINITIONS.find((d) => d.id === "hubspot") ?? null },
      ...fromRegistry.filter((d) => d.id !== "hubspot"),
    ];
  }, []);

  const [query, setQuery] = useState("");
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, CredRow>>({});
  const [loaded, setLoaded] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SearchableIntegration | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState("");
  const [removing, setRemoving] = useState(false);

  const reloadRecords = useCallback(async () => {
    try {
      const { records } = await adminFetch<{ records: CredRow[] }>(
        "admin-api", "/integration-credentials",
        { query: { customer_id: customerId } },
      );
      const map: Record<string, CredRow> = {};
      for (const r of records) map[r.integration_id] = r;
      setRecords(map);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load integrations");
    }
  }, [customerId]);

  const reloadPins = useCallback(async () => {
    try {
      const { pins } = await adminFetch<{ pins: { integration_id: string }[] }>(
        "admin-api", "/integration-pins",
        { query: { customer_id: customerId } },
      );
      setActiveIds(pins.map((p) => p.integration_id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load pinned integrations");
    }
  }, [customerId]);

  useEffect(() => {
    setActiveIds([]);
    setRecords({});
    setLoaded(false);
    void Promise.all([reloadPins(), reloadRecords()]).finally(() => setLoaded(true));
  }, [customerId, reloadPins, reloadRecords]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allIntegrations
      .filter((i) => !activeIds.includes(i.id))
      .filter((i) => i.displayName.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, allIntegrations, activeIds]);

  const addIntegration = async (id: string) => {
    setQuery("");
    setActiveIds((p) => (p.includes(id) ? p : [...p, id]));
    try {
      await adminFetch("admin-api", "/integration-pins", {
        method: "POST",
        body: { customer_id: customerId, integration_id: id },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add integration");
      setActiveIds((p) => p.filter((x) => x !== id));
    }
  };

  const requestRemove = (entry: SearchableIntegration) => {
    setRemoveTarget(entry);
    setRemoveConfirm("");
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    if (removeConfirm.trim().toLowerCase() !== "delete") return;
    setRemoving(true);
    const id = removeTarget.id;
    try {
      if (id === "hubspot") {
        await adminFetch("admin-api", "/integrations/hubspot", {
          method: "DELETE",
          query: { customer_id: customerId },
        });
      }
      await adminFetch("admin-api", `/integration-credentials/${id}`, {
        method: "DELETE",
        query: { customer_id: customerId, hard: "1" },
      }).catch(() => undefined);
      await adminFetch("admin-api", `/integration-pins/${id}`, {
        method: "DELETE",
        query: { customer_id: customerId },
      });
      setActiveIds((p) => p.filter((x) => x !== id));
      setRecords((r) => { const next = { ...r }; delete next[id]; return next; });
      toast.success(`${removeTarget.displayName} removed.`);
      setRemoveTarget(null);
      setRemoveConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove integration");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
          <Plug size={14} className="text-primary" /> Search &amp; Add Integrations
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Search for a platform and add it to this client. Each integration is configured, tested, and saved independently and remains pinned to this client until you remove it.
        </p>
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 rounded-md border border-border/40 bg-white px-3 py-2">
          <Search size={14} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search & Add Integrations (e.g. HubSpot, SalesChain, E-automate, Printanista…)"
            className="flex-1 bg-transparent text-sm text-black outline-none placeholder:text-muted-foreground/60"
            aria-label="Search & Add Integrations"
          />
        </div>
        {matches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-border/40 bg-popover shadow-lg overflow-hidden">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => void addIntegration(m.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary/40"
              >
                <span className="text-foreground">{m.displayName}</span>
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  <Plus size={12} /> Add
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!loaded ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="animate-spin" size={12} /> Loading integrations…
        </div>
      ) : activeIds.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/40 bg-background/20 px-4 py-6 text-center text-xs text-muted-foreground">
          No integrations added yet. Use the search above to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {activeIds.map((id) => {
            const entry = allIntegrations.find((i) => i.id === id);
            if (!entry) return null;
            if (id === "hubspot") {
              return (
                <HubSpotIntegrationCard
                  key={id}
                  customerId={customerId}
                  customerDisplayName={customerDisplayName}
                  notificationEmail={notificationEmail}
                  onRequestRemove={() => requestRemove(entry)}
                />
              );
            }
            if (BESPOKE_IDS.has(id) && entry.def) {
              return (
                <BespokeIntegrationCard
                  key={id}
                  def={entry.def}
                  customerId={customerId}
                  customerDisplayName={customerDisplayName}
                  notificationEmail={notificationEmail}
                  onRequestRemove={() => requestRemove(entry)}
                />
              );
            }
            return entry.def ? (
              <PlatformIntegrationCard
                key={id}
                def={entry.def}
                customerId={customerId}
                record={records[id] ?? null}
                onChange={reloadRecords}
              />
            ) : null;
          })}
        </div>
      )}

      <Dialog open={!!removeTarget} onOpenChange={(o) => { if (!o) { setRemoveTarget(null); setRemoveConfirm(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Do you want to delete this integration?</DialogTitle>
            <DialogDescription>
              This permanently deletes the saved credentials for <strong>{removeTarget?.displayName}</strong> on this client and removes the card from the list. Type <strong>delete</strong> to complete the action.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={removeConfirm}
            onChange={(e) => setRemoveConfirm(e.target.value)}
            placeholder='Type "delete" to complete the action'
            className="bg-white text-black placeholder:text-muted-foreground/60"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setRemoveTarget(null); setRemoveConfirm(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={removing || removeConfirm.trim().toLowerCase() !== "delete"}
              onClick={() => void confirmRemove()}
            >
              {removing ? <Loader2 className="animate-spin" size={12} /> : null}
              Delete integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LiveAccountIntegrationsPanel;
