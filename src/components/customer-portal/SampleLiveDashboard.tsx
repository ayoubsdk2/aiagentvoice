import { motion } from "framer-motion";
import {
  PhoneIncoming,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  ShieldCheck,
  Clock,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { getFixture } from "./sampleFixtures";
import { SCOPE_META, type SampleScope } from "@/contexts/DemoModeContext";

const PHAOS_PURPLE = "hsl(270 70% 55%)";
const SUCCESS = "hsl(142 71% 45%)";

interface SampleLiveDashboardProps {
  scope?: SampleScope;
}

export default function SampleLiveDashboard({ scope = "local" }: SampleLiveDashboardProps) {
  const f = getFixture(scope);
  const meta = SCOPE_META[scope];

  return (
    <motion.div
      key={scope}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Sample banner */}
      <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/15 to-primary/5 px-4 py-3 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-bold text-foreground">
            {meta.label} Sample Live Dashboard — {f.organization}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Every metric, transcript, lead, and integration on this page is{" "}
            <span className="font-semibold text-foreground">demo data</span> for{" "}
            <span className="font-semibold text-foreground">{meta.subtitle}</span>.
            This is exactly what your live Phaos AI dashboard will look like once Phoebe is connected to your phone numbers, CRM, and ERP.
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 shrink-0">
          {meta.label} · Demo
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Calls handled" value={f.kpis.callsHandled} delta={f.kpis.callsDelta} deltaUp icon={<PhoneIncoming size={14} />} />
        <Kpi label="AI resolution rate" value={f.kpis.resolutionRate} delta={f.kpis.resolutionDelta} deltaUp icon={<Zap size={14} />} />
        <Kpi label="Avg handle time" value={f.kpis.avgHandleTime} delta={f.kpis.ahtDelta} deltaUp icon={<Clock size={14} />} />
        <Kpi label="Qualified leads" value={f.kpis.qualifiedLeads} delta={f.kpis.leadsDelta} deltaUp icon={<Users size={14} />} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="glass-card p-4 lg:col-span-2">
          <SectionHeader title="Call volume — last 7 days" sub="Inbound vs. outbound" />
          <div className="h-56 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={f.callVolume} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="inb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PHAOS_PURPLE} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={PHAOS_PURPLE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="out" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SUCCESS} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={SUCCESS} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.05)" />
                <XAxis dataKey="day" stroke="hsl(0 0% 60%)" fontSize={11} />
                <YAxis stroke="hsl(0 0% 60%)" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 6%)", border: "1px solid hsl(0 0% 100% / 0.1)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="inbound" stroke={PHAOS_PURPLE} fill="url(#inb)" strokeWidth={2} />
                <Area type="monotone" dataKey="outbound" stroke={SUCCESS} fill="url(#out)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-4">
          <SectionHeader title="Intent mix" sub="Last 30 days" />
          <div className="h-56 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={f.intent} dataKey="value" innerRadius={48} outerRadius={78} paddingAngle={2}>
                  {f.intent.map((d) => (
                    <Cell key={d.name} fill={d.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(0 0% 6%)", border: "1px solid hsl(0 0% 100% / 0.1)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 text-[11px]">
            {f.intent.map((i) => (
              <div key={i.name} className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: i.color }} />
                <span className="text-muted-foreground">{i.name}</span>
                <span className="font-bold">{i.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resolution + transcripts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <SectionHeader title="Resolution rate by hour" sub="Auto vs. escalated" />
          <div className="h-44 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={f.resolution} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.05)" />
                <XAxis dataKey="hr" stroke="hsl(0 0% 60%)" fontSize={11} />
                <YAxis stroke="hsl(0 0% 60%)" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 6%)", border: "1px solid hsl(0 0% 100% / 0.1)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="auto" stackId="a" fill={PHAOS_PURPLE} radius={[0, 0, 0, 0]} />
                <Bar dataKey="escalated" stackId="a" fill="hsl(0 65% 55%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-4 lg:col-span-2">
          <SectionHeader title="Recent call transcripts" sub={`${meta.label} sample data`} />
          <div className="mt-3 divide-y divide-border/40">
            {f.transcripts.map((t) => (
              <div key={t.id} className="py-3 flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <PhoneIncoming size={13} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span className="font-mono">{t.id}</span>
                    <span>•</span>
                    <span>{t.caller}</span>
                    <span>•</span>
                    <span className="font-bold text-foreground">{t.model}</span>
                    {t.error && (
                      <>
                        <span>•</span>
                        <span className="text-amber-400 font-bold">{t.error}</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-foreground/90 mt-1 leading-relaxed line-clamp-2">{t.snippet}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-[hsl(var(--success))]">{t.outcome}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{t.duration}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leads + integrations + compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <SectionHeader title="Hot leads" sub="Auto-scored by Phoebe" />
          <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
            {f.leads.map((l) => (
              <div key={l.name} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-secondary/40 transition-colors">
                <div
                  className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold border ${
                    l.score >= 90
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : l.score >= 80
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                      : "bg-secondary/60 border-border/50 text-muted-foreground"
                  }`}
                >
                  {l.score}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{l.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{l.intent}</div>
                </div>
                <div className="text-xs font-bold text-foreground shrink-0">{l.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-4">
          <SectionHeader title="Integrations health" sub="ERP, CRM, ITSM" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {f.integrations.map((i) => (
              <div key={i.name} className="rounded-lg border border-border/40 bg-secondary/30 px-3 py-2.5">
                <div className="text-xs font-bold truncate">{i.name}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span
                    className={`text-[10px] uppercase tracking-widest font-bold ${
                      i.status === "Connected" ? "text-[hsl(var(--success))]" : "text-muted-foreground"
                    }`}
                  >
                    {i.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">{i.health}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-4">
          <SectionHeader title="Ironclad Compliance" sub="Posture overview" />
          <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
            {f.compliance.map((c) => {
              const tone = c.tone === "ok" ? "text-[hsl(var(--success))]" : "text-amber-400";
              return (
                <div key={c.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 border border-border/40">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={13} className={tone} />
                    <span className="text-xs font-bold">{c.name}</span>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest font-bold ${tone}`}>{c.status}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-primary" />
            <span className="text-[11px] text-foreground/90">Real-time PII scrubbing active on all transcripts.</span>
          </div>
        </div>
      </div>

      {/* ROI strip */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Analytics & ROI snapshot" sub="Estimated weekly savings vs. baseline" />
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[hsl(var(--success))]">
            <ArrowUpRight size={12} /> Trending up
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <RoiCell label="Labor hours saved" value={f.roi.laborHours} />
          <RoiCell label="Cost avoided" value={f.roi.costAvoided} />
          <RoiCell label="First-call resolution" value={f.roi.firstCallResolution} />
          <RoiCell label="Customer CSAT (sim.)" value={f.roi.csat} />
        </div>
      </div>
    </motion.div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <div className="text-sm font-bold tracking-tight">{title}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Kpi({
  label, value, delta, deltaUp, icon,
}: {
  label: string; value: string; delta: string; deltaUp: boolean; icon: React.ReactNode;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <div className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold ${deltaUp ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
        {deltaUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {delta}
      </div>
    </div>
  );
}

function RoiCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/30 px-3 py-3">
      <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
