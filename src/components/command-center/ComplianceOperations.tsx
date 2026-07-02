import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Download, FileText, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportRowsAsCsv } from "@/lib/csv-export";

interface DsarRow {
  id: string;
  request_type: string;
  status: string;
  subject_email: string | null;
  subject_phone: string | null;
  created_at: string;
  fulfilled_at: string | null;
}
interface AgreementRow {
  id: string;
  agreement_type: string;
  status: string;
  signed_at: string | null;
  expires_at: string | null;
  signer_name: string | null;
}
interface SubProcessorRow {
  id: string;
  name: string;
  purpose: string;
  hosting_region: string;
  status: string;
  dpa_signed: boolean;
}
interface RetentionReportEntry {
  customer_id: string;
  table: string;
  cutoff: string;
  would_delete: number;
  mode: string;
}

type ChecklistItem = { key: string; label: string; ok: boolean; hint?: string };

/**
 * Admin-only Compliance Operations console.
 * Reuses existing primitives — no new visual tokens.
 */
export default function ComplianceOperations() {
  const [tab, setTab] = useState<"checklist" | "dsar" | "legal" | "subprocessors" | "retention">("checklist");
  const [loading, setLoading] = useState(true);
  const [dsar, setDsar] = useState<DsarRow[]>([]);
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [subs, setSubs] = useState<SubProcessorRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [retentionReport, setRetentionReport] = useState<RetentionReportEntry[] | null>(null);
  const [retentionRunning, setRetentionRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [dsarRes, legalRes, subRes, killRes, restrictedRes, mfaFactors] = await Promise.all([
        supabase.from("dsar_requests").select("id,request_type,status,subject_email,subject_phone,created_at,fulfilled_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("legal_agreements").select("id,agreement_type,status,signed_at,expires_at,signer_name").order("agreement_type"),
        supabase.from("sub_processors").select("id,name,purpose,hosting_region,status,dpa_signed").order("name"),
        supabase.from("kill_switches").select("id").limit(1),
        supabase.from("restricted_terms").select("id").limit(1),
        supabase.auth.mfa.listFactors(),
      ]);
      if (cancelled) return;
      setDsar((dsarRes.data ?? []) as DsarRow[]);
      setAgreements((legalRes.data ?? []) as AgreementRow[]);
      setSubs((subRes.data ?? []) as SubProcessorRow[]);

      const hasMfa = (mfaFactors.data?.totp ?? []).some((f) => f.status === "verified");
      const items: ChecklistItem[] = [
        { key: "mfa", label: "Admin MFA enrolled", ok: hasMfa, hint: "Set up TOTP at /mfa-setup" },
        { key: "agreements", label: "At least one active legal agreement", ok: (legalRes.data ?? []).some((a) => a.status === "active") },
        { key: "subs", label: "Sub-processors registered", ok: (subRes.data ?? []).length > 0 },
        { key: "kill", label: "Kill-switch configured", ok: (killRes.data ?? []).length > 0 },
        { key: "restricted", label: "Restricted-terms list seeded", ok: (restrictedRes.data ?? []).length > 0 },
        { key: "dsar", label: "DSAR responder identified", ok: true, hint: "compliance@phaosai.com" },
      ];
      setChecklist(items);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function runRetentionDryRun() {
    setRetentionRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("data-retention-sweep", { body: { mode: "dry_run" } });
      if (error) {
        toast.error("Retention dry-run failed", { description: error.message });
        return;
      }
      setRetentionReport((data as { report?: RetentionReportEntry[] })?.report ?? []);
      toast.success("Retention dry-run complete");
    } finally {
      setRetentionRunning(false);
    }
  }

  async function downloadEvidenceBundle() {
    const { data, error } = await supabase.functions.invoke("compliance-evidence-bundle", { body: {} });
    if (error || !data) {
      toast.error("Bundle generation failed", { description: error?.message ?? "Unknown error" });
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phaos-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Evidence bundle downloaded");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-primary" size={22} /> Compliance Operations
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            DSAR queue, signed agreements, sub-processors, retention sweeps, and pre-launch checklist.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadEvidenceBundle} className="gap-1.5">
          <Download size={14} /> Download evidence bundle
        </Button>
      </div>

      <div className="inline-flex items-center rounded-full border border-border/50 bg-secondary/40 p-0.5 text-[11px] font-bold uppercase tracking-wider">
        {([
          ["checklist", "Pre-Launch"],
          ["dsar", "DSAR Queue"],
          ["legal", "Legal Agreements"],
          ["subprocessors", "Sub-Processors"],
          ["retention", "Retention Sweep"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-full transition-colors ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "checklist" && (
        <div className="glass-card divide-y divide-border/30">
          {checklist.map((item) => (
            <div key={item.key} className="p-4 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${item.ok ? "bg-[hsl(var(--success))]" : "bg-destructive"}`} />
              <div className="flex-1">
                <div className="text-sm font-semibold">{item.label}</div>
                {item.hint && <div className="text-[11px] text-muted-foreground">{item.hint}</div>}
              </div>
              <span className={`text-[11px] uppercase tracking-widest font-bold ${item.ok ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                {item.ok ? "Ready" : "Action needed"}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "dsar" && (
        <div className="glass-card overflow-hidden">
          <div className="p-3 flex items-center justify-between border-b border-border/30">
            <span className="text-xs text-muted-foreground">{dsar.length} request{dsar.length === 1 ? "" : "s"}</span>
            <Button
              variant="outline" size="sm"
              onClick={() => exportRowsAsCsv("phaos-dsar.csv", dsar as unknown as Record<string, unknown>[])}
              className="gap-1.5"
            >
              <Download size={14} /> Export CSV
            </Button>
          </div>
          {dsar.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No DSAR requests on file.</div>
          ) : (
            <div className="divide-y divide-border/30">
              {dsar.map((d) => (
                <div key={d.id} className="p-3 text-xs flex items-center gap-3">
                  <FileText size={14} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{d.request_type} · {d.subject_email ?? d.subject_phone ?? "unknown subject"}</div>
                    <div className="text-muted-foreground">Created {new Date(d.created_at).toLocaleString()}</div>
                  </div>
                  <span className="uppercase tracking-widest text-[10px] font-bold text-primary">{d.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "legal" && (
        <div className="glass-card divide-y divide-border/30">
          {agreements.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No agreements registered.</div>
          ) : agreements.map((a) => (
            <div key={a.id} className="p-3 text-xs flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{a.agreement_type}</div>
                <div className="text-muted-foreground">
                  {a.signer_name ?? "—"} · signed {a.signed_at ? new Date(a.signed_at).toLocaleDateString() : "—"}
                </div>
              </div>
              <span className={`text-[10px] uppercase tracking-widest font-bold ${a.status === "active" ? "text-[hsl(var(--success))]" : "text-muted-foreground"}`}>
                {a.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "subprocessors" && (
        <div className="glass-card divide-y divide-border/30">
          {subs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No sub-processors registered.</div>
          ) : subs.map((s) => (
            <div key={s.id} className="p-3 text-xs flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{s.name}</div>
                <div className="text-muted-foreground">{s.purpose} · {s.hosting_region}</div>
              </div>
              <span className={`text-[10px] uppercase tracking-widest font-bold ${s.dpa_signed ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                {s.dpa_signed ? "DPA signed" : "DPA pending"}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "retention" && (
        <div className="space-y-3">
          <div className="glass-card p-4 flex items-center gap-3">
            <AlertCircle className="text-[hsl(48_96%_53%)]" size={18} />
            <p className="text-xs text-muted-foreground flex-1">
              Retention runs in <strong>dry-run mode</strong>: nothing is deleted. The report below shows what
              would be purged per tenant if real deletion were enabled.
            </p>
            <Button onClick={runRetentionDryRun} disabled={retentionRunning} size="sm" variant="outline" className="gap-1.5">
              {retentionRunning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Run dry-run
            </Button>
          </div>
          {retentionReport && (
            retentionReport.length === 0 ? (
              <div className="glass-card p-6 text-center text-sm text-muted-foreground">No tenants with retention windows configured.</div>
            ) : (
              <div className="glass-card divide-y divide-border/30">
                {retentionReport.map((r, i) => (
                  <div key={i} className="p-3 text-xs flex items-center gap-3">
                    <div className="flex-1 min-w-0 truncate">
                      <span className="font-mono text-muted-foreground">{r.customer_id.slice(0, 8)}…</span>{" "}
                      · <strong>{r.table}</strong> · cutoff {new Date(r.cutoff).toLocaleString()}
                    </div>
                    <span className="font-mono text-primary">{r.would_delete} rows</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
