import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plug, Save, Trash2 } from "lucide-react";
import { adminFetch } from "@/lib/admin-session";
import { toast } from "sonner";
import {
  TestConnectionResultsDialog,
  type TestConnectionResultsPayload,
} from "./TestConnectionResultsDialog";

const HUBSPOT_FORM_GUID_PLACEHOLDER = "9xxxxxx9-99x9-9x99-9999-9x9999x99xxx";
const HUBSPOT_PORTAL_ID_PLACEHOLDER = "123456789";
const HUBSPOT_SERVICE_KEY_PLACEHOLDER = "xxx-xx9-xxx99999-x99x-99x9-x999-99xx999x99xx";

interface HubSpotRecord {
  hubspot_form_guid: string | null;
  hubspot_portal_id: string | null;
  status: string | null;
  last_tested_at: string | null;
  last_test_outcome: string | null;
  last_test_error: string | null;
  field_hints: Record<string, unknown> | null;
}

export function HubSpotIntegrationCard({
  customerId,
  customerDisplayName,
  notificationEmail,
  onRequestRemove,
}: {
  customerId: string;
  customerDisplayName: string;
  notificationEmail: string | null;
  onRequestRemove: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<HubSpotRecord | null>(null);
  const [guid, setGuid] = useState("");
  const [portalId, setPortalId] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPayload, setDialogPayload] = useState<TestConnectionResultsPayload | null>(null);
  const [focusedField, setFocusedField] = useState<"guid" | "portalId" | "serviceKey" | null>(null);
  const [allowEntry, setAllowEntry] = useState<Record<"guid" | "portalId" | "serviceKey", boolean>>({
    guid: false,
    portalId: false,
    serviceKey: false,
  });

  const isActive = record?.status === "active";
  const hasSavedToken =
    !!(record?.field_hints && (record.field_hints as Record<string, unknown>).private_app_token_saved);
  const hasSavedGuid = !!record?.hubspot_form_guid ||
    !!(record?.field_hints && (record.field_hints as Record<string, unknown>).hubspot_form_guid);
  const hasSavedPortal = /^\d{4,12}$/.test(String(record?.hubspot_portal_id ?? ""));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { record } = await adminFetch<{ record: HubSpotRecord | null }>(
        "admin-api",
        "/integrations/hubspot",
        { query: { customer_id: customerId } },
      );
      setRecord(record);
      // Don't prefill — placeholders communicate "DATA SAVED" instead.
      setGuid("");
      setPortalId("");
      setServiceKey("");
    } catch {
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { void load(); }, [load]);

  // Save accepts any combination — partial saves are allowed and preserve
  // prior values. Test Connection requires all three to be live (entered now
  // or previously saved).
  const canTest =
    (guid.trim() || hasSavedGuid) &&
    (portalId.trim() || hasSavedPortal) &&
    (serviceKey.trim() || hasSavedToken);

  const persist = useCallback(async () => {
    await adminFetch("admin-api", "/integrations/hubspot/save", {
      method: "POST",
      body: {
        customer_id: customerId,
        // Send each field only if user typed something; backend preserves prior.
        hubspot_form_guid: guid.trim() || undefined,
        portal_id: /^\d{4,12}$/.test(portalId.trim()) ? portalId.trim() : undefined,
        private_app_token: serviceKey.trim() || undefined,
        allow_partial: true,
      },
    });
  }, [customerId, guid, portalId, serviceKey]);

  const handleSave = async () => {
    // Never block — Save is always available.
    setSaving(true);
    try {
      await persist();
      setGuid(""); setPortalId(""); setServiceKey("");
      await load();
    } catch (e) {
      // surface error so user knows
      console.error("HubSpot save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!canTest) return;
    setTesting(true);
    try {
      // Save first so the row exists; ignore failures (test still runs).
      if (guid.trim() || portalId.trim() || serviceKey.trim()) {
        try { await persist(); } catch { /* noop */ }
      }
      const effectiveGuid = guid.trim() || (record?.hubspot_form_guid ?? "");
      const effectivePid = /^\d{4,12}$/.test(portalId.trim())
        ? portalId.trim()
        : (/^\d{4,12}$/.test(String(record?.hubspot_portal_id ?? "")) ? String(record?.hubspot_portal_id ?? "") : "");
      const effectiveToken = serviceKey.trim(); // token can only be re-tested live when re-pasted

      const res = await adminFetch<{
        elements: { key: string; label: string; ok: boolean; reason: string }[];
        allOk: boolean;
        summary: string;
      }>("admin-api", "/integrations/hubspot/test-detailed", {
        method: "POST",
        body: {
          customer_id: customerId,
          credentials: {
            hubspot_form_guid: effectiveGuid,
            portal_id: effectivePid,
            private_app_token: effectiveToken,
          },
        },
      });

      setDialogPayload({
        integrationName: "HubSpot",
        elements: res.elements,
        allOk: res.allOk,
        summary: res.summary,
      });
      setDialogOpen(true);

      if (res.allOk) {
        // Sync HubSpot's bespoke row to active so the badge/toggle reflect it.
        try { await persist(); } catch { /* noop */ }
        const targets = Array.from(
          new Set(["daniel@phaosai.com", notificationEmail || ""].filter(Boolean)),
        );
        const html = `
          <h2>HubSpot verified — ${customerDisplayName}</h2>
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
        const emailResults = await Promise.all(targets.map((to) =>
          adminFetch<{ ok?: boolean; error?: string }>("soa-alert", "/", {
            method: "POST",
            body: {
              to,
              subject: `Phaos AI · HubSpot fully verified — ${customerDisplayName}`,
              html,
              tag: "integration_test_success",
            },
          }).then(() => ({ ok: true as const })).catch((err: unknown) => ({
            ok: false as const,
            error: err instanceof Error ? err.message : String(err),
          })),
        ));
        const resendMissing = emailResults.some((r) =>
          r.ok === false && /resend_not_configured|RESEND_API_KEY/i.test((r as { error?: string }).error ?? ""),
        );
        if (resendMissing) {
          toast.error(
            "Resend API key missing — confirmation email not sent. Add RESEND_API_KEY in backend secrets to enable post-test emails.",
            { duration: 10000 },
          );
        }
      }

      setGuid(""); setPortalId(""); setServiceKey("");
      await load();
    } catch (e) {
      setDialogPayload({
        integrationName: "HubSpot",
        elements: [{
          key: "_error",
          label: "Request",
          ok: false,
          reason: e instanceof Error ? e.message : "Test Connection request failed.",
        }],
        allOk: false,
        summary: "Could not reach the HubSpot test endpoint.",
      });
      setDialogOpen(true);
    } finally {
      setTesting(false);
    }
  };

  const placeholderFor = (
    field: "guid" | "portalId" | "serviceKey",
    saved: boolean,
    value: string,
    example: string,
  ) => {
    if (focusedField === field) return "";
    if (saved && value.length === 0) return "DATA SAVED";
    return example;
  };

  const fieldClass = (saved: boolean, hasValue: boolean) =>
    `font-mono text-xs rounded-md border px-3 py-2 bg-white text-black outline-none border-border/60 focus:border-primary ${
      saved && !hasValue
        ? "placeholder:text-black placeholder:font-bold placeholder:uppercase placeholder:tracking-wider"
        : "placeholder:text-gray-400"
    }`;

  const enableEntry = (field: "guid" | "portalId" | "serviceKey") => {
    setFocusedField(field);
    setAllowEntry((prev) => ({ ...prev, [field]: true }));
  };

  const disableEntry = (field: "guid" | "portalId" | "serviceKey") => {
    setFocusedField(null);
    setAllowEntry((prev) => ({ ...prev, [field]: false }));
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Plug size={16} className="text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">HubSpot Integration</h3>
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
          aria-label="HubSpot active state (controlled by Test Connection)"
          className={isActive ? "data-[state=checked]:bg-emerald-500" : ""}
        />
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground font-semibold">
              HubSpot Form GUID{hasSavedGuid && <span className="ml-1 text-emerald-400">· saved</span>}
            </span>
            <input
              value={guid}
              onChange={(e) => setGuid(e.target.value)}
              onFocus={() => enableEntry("guid")}
              onBlur={() => disableEntry("guid")}
              placeholder={placeholderFor("guid", hasSavedGuid, guid, HUBSPOT_FORM_GUID_PLACEHOLDER)}
              className={fieldClass(hasSavedGuid, guid.length > 0)}
              autoComplete="new-password"
              name={`hubspot-form-guid-${customerId}`}
              readOnly={!allowEntry.guid}
              spellCheck={false}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground font-semibold">
              HubSpot Portal ID{hasSavedPortal && <span className="ml-1 text-emerald-400">· saved</span>}
            </span>
            <input
              value={portalId}
              onChange={(e) => setPortalId(e.target.value)}
              onFocus={() => enableEntry("portalId")}
              onBlur={() => disableEntry("portalId")}
              placeholder={placeholderFor("portalId", hasSavedPortal, portalId, HUBSPOT_PORTAL_ID_PLACEHOLDER)}
              className={fieldClass(hasSavedPortal, portalId.length > 0)}
              autoComplete="new-password"
              name={`hubspot-portal-number-${customerId}`}
              inputMode="numeric"
              pattern="[0-9]*"
              readOnly={!allowEntry.portalId}
              spellCheck={false}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted-foreground font-semibold">
              HubSpot Service Key{hasSavedToken && <span className="ml-1 text-emerald-400">· saved</span>}
            </span>
            <input
              type="text"
              value={serviceKey}
              onChange={(e) => setServiceKey(e.target.value)}
              onFocus={() => enableEntry("serviceKey")}
              onBlur={() => disableEntry("serviceKey")}
              placeholder={placeholderFor("serviceKey", hasSavedToken, serviceKey, HUBSPOT_SERVICE_KEY_PLACEHOLDER)}
              className={fieldClass(hasSavedToken, serviceKey.length > 0)}
              autoComplete="new-password"
              name={`hubspot-service-key-${customerId}`}
              readOnly={!allowEntry.serviceKey}
              spellCheck={false}
            />
          </label>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button onClick={handleTest} disabled={testing || saving || !canTest} size="sm" className="gap-2">
                {testing ? <><Loader2 size={14} className="animate-spin" /> Testing…</> : <>Test Connection</>}
              </Button>
              <Button onClick={handleSave} disabled={saving || testing} size="sm" variant="secondary" className="gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </Button>
              <Button
                onClick={onRequestRemove}
                size="icon"
                variant="ghost"
                aria-label="Remove HubSpot integration"
                title="Remove integration"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={14} />
              </Button>
            </div>
            {record?.last_tested_at && (
              <span className="text-[10px] text-muted-foreground">
                Last test: {new Date(record.last_tested_at).toLocaleString()}
                {record.last_test_outcome ? ` · ${record.last_test_outcome === "verified" || record.last_test_outcome === "ok" ? "successful" : "unsuccessful"}` : ""}
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
