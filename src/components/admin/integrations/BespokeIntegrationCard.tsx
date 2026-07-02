import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plug, Save, Trash2 } from "lucide-react";
import { adminFetch } from "@/lib/admin-session";
import {
  TestConnectionResultsDialog,
  type TestConnectionResultsPayload,
} from "./TestConnectionResultsDialog";
import type { IntegrationDefinition } from "@/lib/integration-registry";

interface CredRecord {
  integration_id: string;
  status: string | null;
  field_hints: Record<string, unknown> | null;
  last_tested_at: string | null;
  last_test_outcome: string | null;
  last_test_error: string | null;
}

/**
 * Bespoke integration card with HubSpot-parity workflow:
 *   Save (silent) · Test Connection (modal) · Trashcan remove (typed confirm)
 *   Active toggle stays inactive until every element verifies.
 */
export function BespokeIntegrationCard({
  def,
  customerId,
  customerDisplayName,
  notificationEmail,
  onRequestRemove,
}: {
  def: IntegrationDefinition;
  customerId: string;
  customerDisplayName: string;
  notificationEmail: string | null;
  onRequestRemove: () => void;
}) {
  const [record, setRecord] = useState<CredRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPayload, setDialogPayload] = useState<TestConnectionResultsPayload | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isActive = record?.status === "active";
  const hasSaved = (k: string) =>
    !!(record?.field_hints && (record.field_hints as Record<string, unknown>)[k]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { records } = await adminFetch<{ records: CredRecord[] }>(
        "admin-api",
        "/integration-credentials",
        { query: { customer_id: customerId } },
      );
      const found = records.find((r) => r.integration_id === def.id) ?? null;
      setRecord(found);
    } catch {
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [customerId, def.id]);

  useEffect(() => { void load(); }, [load]);

  const buildPayload = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const f of def.requiredConfigFields) out[f.key] = values[f.key] ?? "";
    return out;
  };

  // Test requires either freshly typed values OR previously-saved values for every required field.
  const canSubmit = def.requiredConfigFields.every(
    (f) => hasSaved(f.key) || (values[f.key] ?? "").trim().length > 0,
  );
  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send fields the user actually typed; backend preserves prior encrypted values.
      const partial: Record<string, string> = {};
      for (const f of def.requiredConfigFields) {
        const v = (values[f.key] ?? "").trim();
        if (v) partial[f.key] = v;
      }
      await adminFetch("admin-api", `/integrations/${def.id}/save`, {
        method: "POST",
        body: { customer_id: customerId, credentials: partial, allow_partial: true },
      });
      setValues({});
      await load();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Integration save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!canSubmit) return;
    setTesting(true);
    try {
      const res = await adminFetch<{
        elements: { key: string; label: string; ok: boolean; reason: string }[];
        allOk: boolean;
        summary: string;
      }>("admin-api", `/integrations/${def.id}/test-detailed`, {
        method: "POST",
        body: { customer_id: customerId, credentials: buildPayload() },
      });
      const payload: TestConnectionResultsPayload = {
        integrationName: def.displayName,
        elements: res.elements,
        allOk: res.allOk,
        summary: res.summary,
      };
      setDialogPayload(payload);
      setDialogOpen(true);

      // On full success, fire a confirmation email to daniel@phaosai.com.
      if (res.allOk) {
        const targets = Array.from(
          new Set(["daniel@phaosai.com", notificationEmail || ""].filter(Boolean)),
        );
        const html = `
          <h2>${def.displayName} verified — ${customerDisplayName}</h2>
          <p>${res.summary}</p>
          <table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd;font-family:Arial,sans-serif;font-size:13px">
            <thead><tr><th align="left">Element</th><th align="left">Result</th><th align="left">Reason</th></tr></thead>
            <tbody>
              ${res.elements.map((e) => `<tr>
                <td>${e.label}</td>
                <td>${e.ok ? "✅ Pass" : "❌ Fail"}</td>
                <td>${e.reason}</td>
              </tr>`).join("")}
            </tbody>
          </table>
          <p style="color:#666;font-size:12px;margin-top:12px">${new Date().toISOString()}</p>`;
        await Promise.all(targets.map((to) =>
          adminFetch("soa-alert", "/", {
            method: "POST",
            body: {
              to,
              subject: `Phaos AI · ${def.displayName} fully verified — ${customerDisplayName}`,
              html,
              tag: "integration_test_success",
            },
          }).catch(() => undefined),
        ));
      }

      setValues({});
      await load();
    } catch (e) {
      setDialogPayload({
        integrationName: def.displayName,
        elements: [{
          key: "_error",
          label: "Request",
          ok: false,
          reason: e instanceof Error ? e.message : "Test Connection request failed.",
        }],
        allOk: false,
        summary: "Could not reach the test endpoint.",
      });
      setDialogOpen(true);
    } finally {
      setTesting(false);
    }
  };

  const placeholderFor = (key: string, example?: string) => {
    if (focusedField === key) return "";
    if (hasSaved(key) && !(values[key] ?? "").length) return "DATA SAVED";
    return example ?? "";
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Plug size={16} className="text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">
            {def.displayName} Integration
          </h3>
          <Badge
            variant={isActive ? "default" : "secondary"}
            className={isActive ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-muted text-muted-foreground"}
          >
            {isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <Switch
          checked={isActive}
          disabled
          aria-label={`${def.displayName} active state (controlled by Test Connection)`}
          className={isActive ? "data-[state=checked]:bg-emerald-500" : ""}
        />
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <>
          {def.requiredConfigFields.map((f) => {
            const saved = hasSaved(f.key);
            const empty = (values[f.key] ?? "").length === 0;
            const showSavedPlaceholder = saved && empty;
            return (
              <label key={f.key} className="flex flex-col gap-1.5 text-xs">
                <span className="text-muted-foreground font-semibold">
                  {f.label}
                  {saved && <span className="ml-1 text-emerald-400">· saved</span>}
                </span>
                <input
                  type={f.secret ? "password" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                  onFocus={() => setFocusedField(f.key)}
                  onBlur={() => setFocusedField(null)}
                  placeholder={placeholderFor(f.key, f.example)}
                  className={`font-mono text-xs rounded-md border px-3 py-2 bg-white text-black outline-none border-border/60 focus:border-primary ${
                    showSavedPlaceholder
                      ? "placeholder:text-black placeholder:font-bold placeholder:uppercase placeholder:tracking-wider"
                      : "placeholder:text-muted-foreground/50"
                  }`}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            );
          })}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleTest}
                disabled={testing || saving || !canSubmit}
                size="sm"
                className="gap-2"
              >
                {testing ? <><Loader2 size={14} className="animate-spin" /> Testing…</> : <>Test Connection</>}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || testing}
                size="sm"
                variant="secondary"
                className="gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </Button>
              <Button
                onClick={onRequestRemove}
                size="icon"
                variant="ghost"
                aria-label={`Remove ${def.displayName} integration`}
                title="Remove integration"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={14} />
              </Button>
            </div>
            {record?.last_tested_at && (
              <span className="text-[10px] text-muted-foreground">
                Last test: {new Date(record.last_tested_at).toLocaleString()}
                {record.last_test_outcome ? ` · ${record.last_test_outcome === "ok" || record.last_test_outcome === "verified" ? "successful" : "unsuccessful"}` : ""}
              </span>
            )}
          </div>
        </>
      )}

      <TestConnectionResultsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payload={dialogPayload}
      />
    </div>
  );
}
