import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HealthRow {
  component: string;
  status: string;
  latency_ms: number | null;
  checked_at: string;
}

const STATUS_META: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  up: { color: "text-[hsl(var(--success))]", icon: CheckCircle2, label: "Operational" },
  degraded: { color: "text-[hsl(48_96%_53%)]", icon: AlertCircle, label: "Degraded" },
  down: { color: "text-destructive", icon: XCircle, label: "Outage" },
};

/**
 * Public-ish status page (auth still required by current RLS).
 * Pulls latest row per component from system_health_checks and lets users trigger
 * a synthetic check by calling sandbox-health-check.
 */
export default function StatusPage() {
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("system_health_checks")
      .select("component,status,latency_ms,checked_at")
      .order("checked_at", { ascending: false })
      .limit(200);
    // Keep only the most recent row per component
    const seen = new Set<string>();
    const latest: HealthRow[] = [];
    for (const r of (data ?? []) as HealthRow[]) {
      if (seen.has(r.component)) continue;
      seen.add(r.component);
      latest.push(r);
    }
    latest.sort((a, b) => a.component.localeCompare(b.component));
    setRows(latest);
    setLoading(false);
  }

  async function runSyntheticCheck() {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("sandbox-health-check", { body: {} });
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const overall = rows.length === 0
    ? "loading"
    : rows.every((r) => r.status === "up")
      ? "up"
      : rows.some((r) => r.status === "down")
        ? "down"
        : "degraded";
  const overallMeta = STATUS_META[overall as keyof typeof STATUS_META];

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">System Status</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live health of Phaos AI dependencies. Sandbox dependencies are monitored read-only.
            </p>
          </div>
          <button
            onClick={runSyntheticCheck}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border/50 bg-secondary/40 hover:bg-secondary/60 text-xs font-bold tracking-wide disabled:opacity-50"
            aria-label="Run health check now"
          >
            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Re-check
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-primary" size={20} />
          </div>
        ) : (
          <>
            {overallMeta && (
              <div className="glass-card p-4 flex items-center gap-3">
                <overallMeta.icon className={overallMeta.color} size={22} />
                <div>
                  <div className={`text-base font-bold ${overallMeta.color}`}>
                    {overall === "up" ? "All Systems Operational" : overallMeta.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {rows.length} component{rows.length === 1 ? "" : "s"} monitored
                  </div>
                </div>
              </div>
            )}

            {rows.length === 0 ? (
              <div className="glass-card p-6 text-center text-sm text-muted-foreground">
                No health checks yet — click <strong>Re-check</strong> to run one.
              </div>
            ) : (
              <div className="glass-card divide-y divide-border/30">
                {rows.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.degraded;
                  const Icon = meta.icon;
                  return (
                    <div key={r.component} className="p-4 flex items-center gap-3">
                      <Icon className={`${meta.color} shrink-0`} size={18} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{r.component}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Last checked {new Date(r.checked_at).toLocaleString()}
                        </div>
                      </div>
                      {r.latency_ms !== null && (
                        <div className="text-xs font-mono text-muted-foreground">{r.latency_ms} ms</div>
                      )}
                      <div className={`text-[11px] font-bold uppercase tracking-widest ${meta.color}`}>
                        {meta.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground text-center">
              Build {import.meta.env.MODE} · v4.2.0-enterprise
            </p>
          </>
        )}
      </div>
    </div>
  );
}
