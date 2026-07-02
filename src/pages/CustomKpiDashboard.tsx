import { useEffect, useState } from "react";
import { Pin, Trash2, Loader2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface KpiPin { id: string; metric_key: string; display_label: string; display_order: number; }

const AVAILABLE_METRICS = [
  { key: "calls_total", label: "Total Calls (30d)" },
  { key: "ai_resolved", label: "AI-Resolved Calls (30d)" },
  { key: "avg_handle_time", label: "Avg Handle Time (sec)" },
  { key: "lead_count", label: "Leads Captured (30d)" },
  { key: "sandbox_calls", label: "Sandbox Calls (7d)" },
  { key: "sandbox_minutes", label: "Sandbox Minutes (7d)" },
  { key: "active_users", label: "Active Users (7d)" },
] as const;

interface KpiSnapshot { metric_key: string; value: number; }

export default function CustomKpiDashboard() {
  const [pins, setPins] = useState<KpiPin[]>([]);
  const [snapshot, setSnapshot] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) { setLoading(false); return; }
    const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [pinsRes, callsTotal, callsResolved, leads, sbStarted, sbEnded, activeUsers] = await Promise.all([
      supabase.from("kpi_pins").select("id,metric_key,display_label,display_order").eq("user_id", u.user.id).order("display_order"),
      supabase.from("calls").select("id", { count: "exact", head: true }).gte("created_at", since30d),
      supabase.from("calls").select("id", { count: "exact", head: true }).gte("created_at", since30d).eq("ai_resolved", true),
      supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since30d),
      supabase.from("sandbox_usage_events").select("id", { count: "exact", head: true }).gte("created_at", since7d).eq("event_type", "call_started"),
      supabase.from("sandbox_usage_events").select("duration_seconds").gte("created_at", since7d).eq("event_type", "call_ended"),
      supabase.from("user_activity_sessions").select("user_id").gte("created_at", since7d).eq("event_type", "login_success"),
    ]);

    setPins((pinsRes.data ?? []) as KpiPin[]);
    const sandboxMinutes = ((sbEnded.data ?? []) as Array<{ duration_seconds: number | null }>)
      .reduce((a, r) => a + Math.round((r.duration_seconds ?? 0) / 60), 0);
    const activeSet = new Set(((activeUsers.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));

    setSnapshot({
      calls_total: callsTotal.count ?? 0,
      ai_resolved: callsResolved.count ?? 0,
      avg_handle_time: 0, // requires metrics_snapshots aggregation; placeholder
      lead_count: leads.count ?? 0,
      sandbox_calls: sbStarted.count ?? 0,
      sandbox_minutes: sandboxMinutes,
      active_users: activeSet.size,
    });
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, []);

  async function pinMetric(metric_key: string, label: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return;
    const { error } = await supabase.from("kpi_pins").insert({
      user_id: u.user.id, metric_key, display_label: label, display_order: pins.length,
    });
    if (error) {
      toast.error("Couldn't pin metric", { description: error.message });
      return;
    }
    toast.success("Metric pinned");
    void loadData();
  }

  async function removePin(id: string) {
    const { error } = await supabase.from("kpi_pins").delete().eq("id", id);
    if (error) {
      toast.error("Couldn't remove pin", { description: error.message });
      return;
    }
    void loadData();
  }

  const pinnedKeys = new Set(pins.map((p) => p.metric_key));
  const available = AVAILABLE_METRICS.filter((m) => !pinnedKeys.has(m.key));

  return (
    <div className="space-y-6 p-6 md:p-8">
      <header>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="text-primary" size={22} /> Custom KPI Dashboard
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Pin metrics that matter to you. Pinned metrics are personal to your account.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : (
        <>
          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Pinned</h3>
            {pins.length === 0 ? (
              <div className="glass-card p-6 text-center text-sm text-muted-foreground">No pinned metrics yet — pick from the catalog below.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {pins.map((p) => (
                  <div key={p.id} className="glass-card p-4 relative">
                    <button
                      onClick={() => removePin(p.id)}
                      aria-label={`Remove ${p.display_label}`}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{p.display_label}</div>
                    <div className="text-2xl font-extrabold mt-1 tabular-nums">
                      {snapshot[p.metric_key]?.toLocaleString() ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {available.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Catalog</h3>
              <div className="glass-card divide-y divide-border/30">
                {available.map((m) => (
                  <div key={m.key} className="p-3 flex items-center gap-3">
                    <div className="flex-1 text-sm">{m.label}</div>
                    <div className="text-xs font-mono text-muted-foreground tabular-nums">
                      {snapshot[m.key]?.toLocaleString() ?? "—"}
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => pinMetric(m.key, m.label)}>
                      <Pin size={12} /> Pin
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
