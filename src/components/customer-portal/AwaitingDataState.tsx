import { Database, Sparkles, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { useDemoMode, SCOPE_META, type SampleScope } from "@/contexts/DemoModeContext";
import { useCustomerTenant } from "@/contexts/CustomerTenantContext";

interface AwaitingDataStateProps {
  title: string;
  description: string;
}

const EMPTY = "None — awaiting setup";

/**
 * Polished empty state for Analytics / Calls when demo mode is OFF and no real
 * tenant data has flowed in. Shows:
 *   - what tenant fields are still missing
 *   - quick scope buttons to enable a sample preview
 */
export function AwaitingDataState({ title, description }: AwaitingDataStateProps) {
  const { enable } = useDemoMode();
  const t = useCustomerTenant();

  const checks: Array<{ id: string; label: string; ok: boolean; hint: string }> = [
    {
      id: "org",
      label: "Organization connected",
      ok: t.organization !== EMPTY,
      hint: "Link your organization profile so dashboards can scope data.",
    },
    {
      id: "loc",
      label: "At least one location",
      ok: t.location !== EMPTY,
      hint: "Add the offices Phoebe will route calls between.",
    },
    {
      id: "num",
      label: "Phone number provisioned",
      ok: t.phoneNumber !== EMPTY,
      hint: "Provision a number or port your existing line.",
    },
  ];
  const missingCount = checks.filter((c) => !c.ok).length;

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-xl p-6 md:p-8">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
          <Database className="text-primary" size={20} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {/* Missing tenant data checklist */}
        <div className="rounded-lg border border-border/40 bg-secondary/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              Tenant readiness
            </div>
            <span
              className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${
                missingCount === 0
                  ? "border-[hsl(var(--success))]/40 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10"
                  : "border-amber-500/40 text-amber-400 bg-amber-500/10"
              }`}
            >
              {missingCount === 0 ? "Ready" : `${missingCount} missing`}
            </span>
          </div>
          <ul className="space-y-2.5">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5">
                {c.ok ? (
                  <CheckCircle2 size={14} className="mt-0.5 text-[hsl(var(--success))] shrink-0" />
                ) : (
                  <XCircle size={14} className="mt-0.5 text-amber-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground">{c.label}</div>
                  {!c.ok && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Sample scope launcher */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={13} className="text-primary" />
            <div className="text-[10px] uppercase tracking-widest font-bold text-primary">
              Preview a sample account
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground mb-3">
            Pick a scale to see exactly what your live dashboard will look like.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SCOPE_META) as SampleScope[]).map((scope) => {
              const meta = SCOPE_META[scope];
              return (
                <button
                  key={scope}
                  onClick={() => enable(scope)}
                  className="text-left rounded-md border border-border/40 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-colors px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{meta.label}</span>
                    <ArrowRight size={11} className="text-muted-foreground" />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {meta.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
