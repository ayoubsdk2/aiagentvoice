import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  Filter,
  Info,
  Loader2,
  MapPin,
  PhoneIncoming,
  Phone,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useCustomerAnalytics,
  analyticsCapabilities,
  defaultFilters,
  type AnalyticsKPIs,
} from "@/hooks/useCustomerAnalytics";
import { supabase } from "@/integrations/supabase/client";
import SampleLiveDashboard from "@/components/customer-portal/SampleLiveDashboard";
import { AwaitingDataState } from "@/components/customer-portal/AwaitingDataState";
import { useDemoMode } from "@/contexts/DemoModeContext";

const RANGE_PRESETS: { label: string; days: number }[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Year to date", days: 365 },
];

const PIE_COLORS = ["#a855f7", "#22d3ee", "#f472b6", "#fbbf24", "#34d399", "#94a3b8"];

export default function CustomerAnalyticsPage() {
  const a = useCustomerAnalytics();
  const caps = analyticsCapabilities(a.role);
  const [liveMode, setLiveMode] = useState(false);
  const { toast } = useToast();
  const { state: demoState } = useDemoMode();

  // Live polling — refresh every 30s when enabled. MUST be before any early
  // returns to keep hook order stable across demo-mode toggles.
  useLivePoll(liveMode, a.refresh);

  // Sample mode ON → show the chosen-scope sample dashboard.
  if (demoState.enabled) {
    return <SampleLiveDashboard scope={demoState.scope} />;
  }

  // Sample mode OFF + trial/no-tenant → empty state inviting sample preview.
  if (caps.sampleOnly) {
    return (
      <AwaitingDataState
        title="No analytics yet"
        description="Your live analytics will populate here automatically once Phoebe starts handling calls. Until then, preview a sample account to see what's coming."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Header
        orgName={a.orgName}
        loading={a.loading}
        liveMode={liveMode}
        onToggleLive={setLiveMode}
        onRefresh={a.refresh}
        canExport={caps.canExport}
        onExport={(scope) => exportCsv(a, scope, toast)}
      />

      <FiltersBar a={a} />

      {a.error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <div className="font-medium text-destructive">
              Couldn't load analytics
            </div>
            <div className="text-muted-foreground">{a.error}</div>
          </div>
        </div>
      )}

      {a.loading ? (
        <LoadingShell />
      ) : a.kpis.totalCalls === 0 && a.kpis.totalLeads === 0 ? (
        <EmptyState orgId={a.orgId} />
      ) : (
        <>
          <KpiGrid kpis={a.kpis} prev={a.prevKpis} savingsPerCall={a.savingsPerCall} />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-border/60 bg-card/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Call volume & resolution</CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    Live tenant data
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={a.daily}>
                      <defs>
                        <linearGradient id="gCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={shortDate} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip content={<DarkTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="calls" name="Total calls" stroke="#a855f7" fill="url(#gCalls)" strokeWidth={2} />
                      <Area type="monotone" dataKey="resolved" name="AI resolved" stroke="#22d3ee" fill="url(#gResolved)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Outcomes mix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={a.outcomes} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {a.outcomes.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<DarkTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60 bg-card/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Cumulative ROI
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  Org savings rate · ${a.savingsPerCall.toFixed(2)}/resolved call
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={a.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={shortDate} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${formatCompact(v)}`} />
                    <Tooltip content={<DarkTooltip valuePrefix="$" />} />
                    <Line type="monotone" dataKey="cumulativeSavings" name="Cumulative savings" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Top locations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {a.locationPerformance.length === 0 ? (
                  <EmptyMini label="No location data in this range." />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={a.locationPerformance.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                        <XAxis dataKey="location_name" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} angle={-15} height={50} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip content={<DarkTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="calls" name="Calls" fill="#a855f7" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="resolved" name="Resolved" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" /> Phone number performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {a.numberPerformance.length === 0 ? (
                  <EmptyMini label="No number traffic in this range." />
                ) : (
                  <PerformanceTable
                    rows={a.numberPerformance.slice(0, 8).map((n) => ({
                      label: n.friendly_name || n.number,
                      sub: `${n.number}${n.location_name ? ` · ${n.location_name}` : ""}`,
                      calls: n.calls,
                      resolved: n.resolved,
                      rate: n.resolutionRate,
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60 bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Location performance
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Location</th>
                    <th className="px-4 py-3 text-right">Calls</th>
                    <th className="px-4 py-3 text-right">Resolved</th>
                    <th className="px-4 py-3 text-right">Resolution</th>
                    <th className="px-4 py-3 text-right">Avg AHT</th>
                    <th className="px-4 py-3 text-right">Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {a.locationPerformance.map((l) => (
                    <tr key={l.location_id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-3 font-medium">{l.location_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.calls}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.resolved}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{(l.resolutionRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatDuration(l.avgHandleTimeSec)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-primary">${l.savings.toLocaleString()}</td>
                    </tr>
                  ))}
                  {a.locationPerformance.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                        No data for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            All figures scoped to your organization · {a.locations.length} location
            {a.locations.length === 1 ? "" : "s"} visible to your role
          </div>
        </>
      )}
    </div>
  );
}

function Header({
  orgName,
  loading,
  liveMode,
  onToggleLive,
  onRefresh,
  canExport,
  onExport,
}: {
  orgName: string | null;
  loading: boolean;
  liveMode: boolean;
  onToggleLive: (v: boolean) => void;
  onRefresh: () => Promise<void>;
  canExport: boolean;
  onExport: (scope: "calls" | "locations" | "numbers") => Promise<void>;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          Governance
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Analytics & ROI</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Tenant-scoped performance for {orgName ?? "your organization"} — KPI cards,
          dynamic ROI, location and number drill-downs, and exportable evidence.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5">
          <span className="text-xs text-muted-foreground">Live</span>
          <Switch checked={liveMode} onCheckedChange={onToggleLive} />
          {liveMode && (
            <span className="ml-1 inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
        {canExport && (
          <ExportMenu onExport={onExport} />
        )}
      </div>
    </header>
  );
}

function ExportMenu({ onExport }: { onExport: (scope: "calls" | "locations" | "numbers") => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" onClick={() => setOpen((o) => !o)} className="gap-1.5">
        <Download className="h-4 w-4" /> Export
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-border/60 bg-popover p-1 shadow-lg">
          {[
            { id: "calls", label: "Calls (CSV)" },
            { id: "locations", label: "Location performance (CSV)" },
            { id: "numbers", label: "Number performance (CSV)" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setOpen(false);
                void onExport(opt.id as "calls" | "locations" | "numbers");
              }}
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FiltersBar({ a }: { a: ReturnType<typeof useCustomerAnalytics> }) {
  const periodLabel = useMemo(() => {
    const ms = new Date(a.filters.to).getTime() - new Date(a.filters.from).getTime();
    const days = Math.round(ms / 86400000);
    return `${days} day${days === 1 ? "" : "s"}`;
  }, [a.filters.from, a.filters.to]);

  return (
    <Card className="border-border/60 bg-card/40">
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={String(rangeDays(a.filters.from, a.filters.to))}
            onValueChange={(v) => {
              const days = Number(v);
              const to = new Date();
              const from = new Date(to.getTime() - days * 86400000);
              a.setFilters({ from: from.toISOString(), to: to.toISOString() });
            }}
          >
            <SelectTrigger className="w-[160px]">
              <Calendar className="mr-2 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_PRESETS.map((p) => (
                <SelectItem key={p.days} value={String(p.days)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={a.filters.locationId}
            onValueChange={(v) => a.setFilters({ locationId: v })}
          >
            <SelectTrigger className="w-[200px]">
              <MapPin className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {a.locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={a.filters.phoneNumberId}
            onValueChange={(v) => a.setFilters({ phoneNumberId: v })}
          >
            <SelectTrigger className="w-[220px]">
              <Phone className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="All numbers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All numbers</SelectItem>
              {a.numbers.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.friendly_name || n.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Period: {periodLabel}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => a.setFilters(defaultFilters())}
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function rangeDays(fromIso: string, toIso: string): number {
  return Math.max(
    1,
    Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000)
  );
}

function KpiGrid({
  kpis,
  prev,
  savingsPerCall,
}: {
  kpis: AnalyticsKPIs;
  prev: AnalyticsKPIs;
  savingsPerCall: number;
}) {
  const cards: {
    label: string;
    value: string;
    icon: typeof Activity;
    delta?: number;
    accent?: boolean;
    sub?: string;
  }[] = [
    {
      label: "Total calls",
      value: kpis.totalCalls.toLocaleString(),
      icon: PhoneIncoming,
      delta: pctDelta(kpis.totalCalls, prev.totalCalls),
    },
    {
      label: "AI resolution rate",
      value: `${(kpis.resolutionRate * 100).toFixed(1)}%`,
      icon: CheckCircle2,
      delta: pctDelta(kpis.resolutionRate, prev.resolutionRate),
    },
    {
      label: "Total savings",
      value: `$${kpis.totalSavings.toLocaleString()}`,
      icon: DollarSign,
      delta: pctDelta(kpis.totalSavings, prev.totalSavings),
      accent: true,
      sub: `@ $${savingsPerCall.toFixed(2)}/resolved`,
    },
    {
      label: "Avg handle time",
      value: formatDuration(kpis.avgHandleTimeSec),
      icon: Clock,
      delta: -pctDelta(kpis.avgHandleTimeSec, prev.avgHandleTimeSec), // lower is better
    },
    {
      label: "Transfer rate",
      value: `${(kpis.transferRate * 100).toFixed(1)}%`,
      icon: Activity,
      delta: -pctDelta(kpis.transferRate, prev.transferRate),
    },
    {
      label: "Qualified leads",
      value: kpis.qualifiedLeads.toLocaleString(),
      icon: Target,
      sub: `of ${kpis.totalLeads.toLocaleString()} total`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label} className={`border-border/60 ${c.accent ? "bg-primary/10" : "bg-card/40"} backdrop-blur`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {c.label}
              </div>
              <c.icon className={`h-4 w-4 ${c.accent ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{c.value}</div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              {typeof c.delta === "number" && Number.isFinite(c.delta) && (
                <DeltaPill value={c.delta} />
              )}
              {c.sub && <span>{c.sub}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DeltaPill({ value }: { value: number }) {
  if (!Number.isFinite(value)) return null;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${
        up
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-rose-500/15 text-rose-300"
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function pctDelta(cur: number, prev: number): number {
  if (!prev) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function PerformanceTable({
  rows,
}: {
  rows: { label: string; sub?: string; calls: number; resolved: number; rate: number }[];
}) {
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{r.label}</div>
            {r.sub && <div className="truncate text-[11px] text-muted-foreground">{r.sub}</div>}
          </div>
          <div className="w-32">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{r.calls} calls</span>
              <span>{(r.rate * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.round(r.rate * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ orgId }: { orgId: string | null }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-12 text-center">
      <BarChart3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="text-lg font-semibold">No analytics data yet</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {orgId
          ? "Once Phoebe starts taking calls, your live KPIs, ROI, and location drill-downs will appear here automatically."
          : "Your account isn't linked to an organization yet. Contact your admin to get provisioned."}
      </p>
    </div>
  );
}

function EmptyMini({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DarkTooltip({ active, payload, label, valuePrefix }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border/60 bg-popover/95 p-2 text-xs shadow-lg backdrop-blur">
      <div className="font-medium">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="tabular-nums">
            {valuePrefix ?? ""}
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toString();
}

function formatDuration(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function useLivePoll(enabled: boolean, refresh: () => Promise<void>) {
  // Lightweight 30s poll — separate from React Query to avoid extra deps.
  // Pauses when tab hidden.
  if (typeof window === "undefined") return;
  // Using inline effect to keep file self-contained
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useMemo(() => {
    if (!enabled) return undefined;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

async function exportCsv(
  a: ReturnType<typeof useCustomerAnalytics>,
  scope: "calls" | "locations" | "numbers",
  toast: ReturnType<typeof useToast>["toast"]
) {
  try {
    let csv = "";
    let filename = "";
    if (scope === "calls") {
      const header = [
        "id",
        "started_at",
        "duration_sec",
        "ai_resolved",
        "transferred_to_human",
        "outcome",
        "location_id",
        "phone_number_id",
      ];
      csv = [
        header.join(","),
        ...a.rawCalls.map((c) =>
          header.map((h) => csvCell((c as unknown as Record<string, unknown>)[h])).join(",")
        ),
      ].join("\n");
      filename = "analytics_calls.csv";
    } else if (scope === "locations") {
      const header = ["location_name", "calls", "resolved", "resolution_rate", "avg_handle_time_sec", "savings"];
      csv = [
        header.join(","),
        ...a.locationPerformance.map((l) =>
          [
            csvCell(l.location_name),
            l.calls,
            l.resolved,
            l.resolutionRate.toFixed(4),
            l.avgHandleTimeSec,
            l.savings,
          ].join(",")
        ),
      ].join("\n");
      filename = "analytics_locations.csv";
    } else {
      const header = ["number", "friendly_name", "location", "calls", "resolved", "resolution_rate"];
      csv = [
        header.join(","),
        ...a.numberPerformance.map((n) =>
          [
            csvCell(n.number),
            csvCell(n.friendly_name ?? ""),
            csvCell(n.location_name ?? ""),
            n.calls,
            n.resolved,
            n.resolutionRate.toFixed(4),
          ].join(",")
        ),
      ].join("\n");
      filename = "analytics_numbers.csv";
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    // Audit-log every export — RLS guarantees we can only insert into our org.
    if (a.orgId) {
      await supabase.from("portal_audit_events").insert([
        {
          org_id: a.orgId,
          event_type: "analytics.export",
          event_scope: "analytics",
          resource_type: "csv",
          metadata: {
            scope,
            filters: a.filters,
            row_count:
              scope === "calls"
                ? a.rawCalls.length
                : scope === "locations"
                ? a.locationPerformance.length
                : a.numberPerformance.length,
          } as never,
        },
      ]);
    }

    toast({ title: "Export ready", description: filename });
  } catch (e) {
    toast({
      title: "Export failed",
      description: e instanceof Error ? e.message : "Unknown error",
      variant: "destructive",
    });
  }
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
