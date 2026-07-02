import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plug, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { adminFetch } from "@/lib/admin-session";
import { INTEGRATION_DEFINITIONS, type IntegrationDefinition } from "@/lib/integration-registry";

// Integrations already rendered as bespoke cards above this section.
const EXCLUDED_IDS = new Set(["hubspot", "sales_chain", "eautomate", "printanista"]);

interface CredRecord {
  integration_id: string;
  status: string | null;
  field_hints: Record<string, unknown> | null;
  last_tested_at: string | null;
  last_test_outcome: string | null;
  last_test_error: string | null;
  updated_at: string | null;
}

export function PlatformIntegrationsSection({ customerId }: { customerId: string }) {
  const [records, setRecords] = useState<Record<string, CredRecord>>({});
  const [loading, setLoading] = useState(true);

  const defs = useMemo(
    () => INTEGRATION_DEFINITIONS.filter((d) => !EXCLUDED_IDS.has(d.id)),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { records } = await adminFetch<{ records: CredRecord[] }>(
        "admin-api", "/integration-credentials",
        { query: { customer_id: customerId } },
      );
      const map: Record<string, CredRecord> = {};
      for (const r of records) map[r.integration_id] = r;
      setRecords(map);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load platform integrations");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground flex items-center gap-2">
          <Plug size={14} className="text-primary" /> Platform Integrations
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Per-client integrations wired to this company's voice agents. Credentials are encrypted at rest and tied to this Live Account only.
        </p>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="animate-spin" size={12} /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {defs.map((def) => (
            <PlatformIntegrationCard
              key={def.id}
              def={def}
              customerId={customerId}
              record={records[def.id] ?? null}
              onChange={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlatformIntegrationCard({
  def, customerId, record, onChange,
}: {
  def: IntegrationDefinition;
  customerId: string;
  record: CredRecord | null;
  onChange: () => void;
}) {
  const isActive = record?.status === "active";
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Prefill non-secret keys if we have hints (we don't store raw values, just keys)
    setValues({});
    setError(null);
  }, [customerId, def.id]);

  const handleSave = async () => {
    setError(null);
    const missing = def.requiredConfigFields.filter((f) => !values[f.key] || values[f.key].trim() === "");
    if (missing.length > 0) {
      setError(`Missing: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const res = await adminFetch<{ status: string; message?: string }>(
        "admin-api", "/integration-credentials",
        { method: "POST", body: { customer_id: customerId, integration_id: def.id, credentials: values } },
      );
      if (res.status === "active") {
        toast.success(`${def.displayName} connected.`);
        setValues({});
        onChange();
      } else {
        setError(res.message ?? "Validation failed.");
        toast.error(`${def.displayName} validation failed.`);
        onChange();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    try {
      await adminFetch("admin-api", `/integration-credentials/${def.id}`, {
        method: "DELETE", query: { customer_id: customerId },
      });
      toast.success(`${def.displayName} disabled.`);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-foreground">{def.displayName}</h4>
            <Badge
              variant={isActive ? "default" : "secondary"}
              className={isActive ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]" : "text-[10px]"}
            >
              {isActive ? "Active" : (record?.status === "failed" ? "Failed" : "Inactive")}
            </Badge>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{def.kind}</span>
          </div>
          {record?.last_tested_at && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Last test: {new Date(record.last_tested_at).toLocaleString()}
            </div>
          )}
        </div>
        <Switch
          checked={isActive}
          disabled={!isActive}
          onCheckedChange={(c) => { if (!c) void handleDisable(); }}
          aria-label={`${def.displayName} toggle`}
          className={isActive ? "data-[state=checked]:bg-emerald-500" : ""}
        />
      </div>

      <div className="grid grid-cols-1 gap-2">
        {def.requiredConfigFields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-[11px]">
            <span className="text-muted-foreground font-semibold">
              {f.label}{f.secret ? " (secret)" : ""}
              {record?.field_hints?.[f.key] ? <span className="ml-1 text-emerald-400">· saved</span> : null}
            </span>
            <Input
              type={f.secret ? "password" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
              placeholder={record?.field_hints?.[f.key] ? "•••••• (enter new to replace)" : (f.example ?? "")}
              className="font-mono text-[11px]"
              autoComplete="off"
            />
          </label>
        ))}
      </div>

      {record?.last_test_error && !error && (
        <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-1.5 text-[10px] text-orange-300">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>{record.last_test_error}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {isActive && !error && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[10px] text-emerald-300">
          <CheckCircle2 size={11} className="mt-0.5 shrink-0" />
          <span>Connected and validated for this company.</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 size={12} className="animate-spin" /> : null}
          {saving ? "Testing…" : (isActive ? "Update & retest" : "Save & test")}
        </Button>
      </div>
    </div>
  );
}
