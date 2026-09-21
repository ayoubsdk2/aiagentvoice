import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle, FileText, Lock, Phone, Globe, Database, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/useCurrentOrg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RegRow {
  regulation_code: string;
  regulation_name: string;
  legal_agreement_status: string;
  annex_generated: boolean;
  controls_mapped: number;
}
interface EvidenceRow {
  agreement_type: string;
  status: string;
  signed_at: string | null;
  expires_at: string | null;
  is_complete: boolean;
}

const REG_ICON: Record<string, typeof ShieldCheck> = {
  HIPAA: Lock, GDPR: Globe, "PCI-DSS": Database, TCPA: Phone, ADA: ShieldCheck,
};

export default function CompliancePage() {
  const { org, status } = useCurrentOrg();
  const [loading, setLoading] = useState(true);
  const [regs, setRegs] = useState<RegRow[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);

  async function refresh() {
    if (!org) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: r, error: rErr }, { data: e, error: eErr }] = await Promise.all([
        supabase.rpc("tenant_compliance_summary", { _customer_id: org.id }),
        supabase.rpc("tenant_compliance_evidence_status", { _customer_id: org.id }),
      ]);
      if (rErr) throw rErr;
      if (eErr) throw eErr;
      setRegs((r ?? []) as RegRow[]);
      setEvidence((e ?? []) as EvidenceRow[]);
    } catch (err) {
      // Non-fatal — surface but render shell
      toast.error(err instanceof Error ? err.message : "Failed to load compliance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [org?.id]);

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (!org) return <div className="text-sm text-muted-foreground">No organization found.</div>;

  const completeAgreements = evidence.filter(e => e.is_complete).length;
  const totalAgreements = evidence.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Governance
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Compliance</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Real-time posture across HIPAA, PCI-DSS, TCPA, GDPR, and ADA. All controls are server-enforced — toggles in your portal trigger live policy updates.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} className="gap-2">
          <RefreshCcw className="w-4 h-4" /> Refresh
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Regulations tracked" value={regs.length} />
        <Kpi label="Active agreements" value={`${completeAgreements}/${totalAgreements || "—"}`} />
        <Kpi label="Annexes generated" value={regs.filter(r => r.annex_generated).length} />
        <Kpi label="Controls mapped" value={regs.reduce((s, r) => s + (r.controls_mapped || 0), 0)} />
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Regulatory posture</h2>
        {regs.length === 0 ? (
          <EmptyShell
            icon={ShieldCheck}
            title="No regulations enabled yet"
            body="Once your team enables HIPAA, PCI, TCPA, or GDPR controls, status appears here in real time."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {regs.map(r => {
              const Icon = REG_ICON[r.regulation_code] ?? ShieldCheck;
              const active = r.legal_agreement_status === "active";
              return (
                <div key={r.regulation_code} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${active ? "bg-emerald-500/15 text-emerald-300" : "bg-muted/30 text-muted-foreground"}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">{r.regulation_name}</div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{r.regulation_code}</div>
                      </div>
                    </div>
                    {active ? (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </Badge>
                    ) : r.legal_agreement_status === "none" ? (
                      <Badge variant="outline" className="text-[10px] bg-muted/40 text-muted-foreground border-border/60">Not started</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-amber-500/15 text-amber-300 border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" /> {r.legal_agreement_status}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Stat label="Annex" value={r.annex_generated ? "Generated" : "Pending"} good={r.annex_generated} />
                    <Stat label="Controls mapped" value={`${r.controls_mapped}`} good={r.controls_mapped > 0} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Legal agreements</h2>
        {evidence.length === 0 ? (
          <EmptyShell
            icon={FileText}
            title="No agreements on file"
            body="BAAs, DPAs, and PCI attestations appear here once they're countersigned by Phaos AI."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Agreement</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Signed</th>
                  <th className="px-4 py-3 text-left">Expires</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map(e => (
                  <tr key={e.agreement_type} className="border-b border-border/40 last:border-0 hover:bg-muted/10">
                    <td className="px-4 py-3 font-medium">{e.agreement_type}</td>
                    <td className="px-4 py-3">
                      {e.is_complete ? (
                        <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-muted/40 text-muted-foreground border-border/60">{e.status}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{e.signed_at ? new Date(e.signed_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{e.expires_at ? new Date(e.expires_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="rounded-xl border border-border/60 bg-card/30 p-4 text-xs text-muted-foreground">
        Need a SOC 2 report, BAA, or custom DPA? Contact{" "}
        <a href="mailto:compliance@phaosai.com" className="text-primary underline-offset-4 hover:underline">compliance@phaosai.com</a>
        {" "}— our team responds within one business day.
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${good ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/60 bg-background/30"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs font-medium">{value}</div>
    </div>
  );
}

function EmptyShell({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
      <Icon className="mx-auto h-7 w-7 text-muted-foreground mb-3" />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
