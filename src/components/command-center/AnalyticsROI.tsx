import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { BarChart3, Download, Check } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { LiveModeEmpty } from "./LiveModeEmpty";

const STORAGE_KEY = "phaos-analytics-metrics";

const ALL_METRICS = [
  { id: "callVolume", label: "Call Volume", value: "1,432", trend: "+12%" },
  { id: "deflectionRate", label: "Deflection Rate", value: "72.4%", trend: "+5.2%" },
  { id: "resolutionRate", label: "Resolution Rate", value: "68.1%", trend: "+3.8%" },
  { id: "avgHandleTime", label: "Avg Handle Time", value: "2m 14s", trend: "-34%" },
  { id: "firstCallRes", label: "First-Call Resolution", value: "61.3%", trend: "+7.1%" },
  { id: "costPerCall", label: "Cost Per Call", value: "$1.24", trend: "-42%" },
  { id: "csatScore", label: "CSAT Score", value: "4.6/5", trend: "+0.3" },
  { id: "agentUtil", label: "Agent Utilization", value: "87.2%", trend: "+4.5%" },
  { id: "transferRate", label: "Transfer Rate", value: "27.6%", trend: "-5.2%" },
  { id: "abandonRate", label: "Abandonment Rate", value: "3.2%", trend: "-1.8%" },
  { id: "repeatCallRate", label: "Repeat Call Rate", value: "8.4%", trend: "-2.1%" },
  { id: "avgWaitTime", label: "Avg Wait Time", value: "0.4s", trend: "-89%" },
  { id: "slaCompliance", label: "SLA Compliance", value: "97.8%", trend: "+2.1%" },
  { id: "revenuePerCall", label: "Revenue Per Call", value: "$18.40", trend: "+22%" },
  { id: "truckRollSavings", label: "Truck Roll Savings", value: "$42,615", trend: "+31%" },
];

const DEFAULT_VISIBLE = ["callVolume", "deflectionRate", "resolutionRate", "avgHandleTime", "costPerCall", "truckRollSavings"];

const WEEKLY_DATA = [
  { day: "Mon", calls: 210, deflected: 145, savings: 2100 },
  { day: "Tue", calls: 245, deflected: 168, savings: 2520 },
  { day: "Wed", calls: 198, deflected: 132, savings: 1980 },
  { day: "Thu", calls: 267, deflected: 189, savings: 2835 },
  { day: "Fri", calls: 312, deflected: 215, savings: 3225 },
  { day: "Sat", calls: 120, deflected: 84, savings: 1260 },
  { day: "Sun", calls: 80, deflected: 56, savings: 840 },
];

const PIE_DATA = [
  { name: "Resolved by AI", value: 68, color: "hsl(270 70% 55%)" },
  { name: "Transferred to Human", value: 18, color: "hsl(200 70% 55%)" },
  { name: "Callback Scheduled", value: 9, color: "hsl(160 60% 45%)" },
  { name: "Abandoned", value: 5, color: "hsl(0 60% 50%)" },
];

const DATE_PRESETS = [
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];

const SUMMARY_TABLE = [
  { metric: "Total Calls Handled", value: "1,432", change: "+12%", status: "up" },
  { metric: "AI-Resolved Calls", value: "975", change: "+18%", status: "up" },
  { metric: "Human Transfers", value: "258", change: "-14%", status: "down" },
  { metric: "Avg Response Latency", value: "340ms", change: "-22%", status: "down" },
  { metric: "Monthly Cost Savings", value: "$42,615", change: "+31%", status: "up" },
  { metric: "Customer Satisfaction", value: "4.6/5.0", change: "+6.9%", status: "up" },
  { metric: "Truck Rolls Avoided", value: "127", change: "+24%", status: "up" },
  { metric: "Toner Orders Auto-Placed", value: "89", change: "+41%", status: "up" },
];

const tooltipStyle = {
  contentStyle: {
    background: "hsl(260 15% 8%)",
    border: "1px solid hsl(260 15% 14%)",
    borderRadius: "8px",
    color: "#f5f5f5",
    fontSize: "12px",
  },
};

export function AnalyticsROI() {
  const { mode } = useAccountMode();
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE;
    } catch { return DEFAULT_VISIBLE; }
  });
  const [dateRange, setDateRange] = useState("this_month");
  const [customStart, setCustomStart] = useState<Date>();
  const [customEnd, setCustomEnd] = useState<Date>();
  const [showMetricPicker, setShowMetricPicker] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleMetrics));
  }, [visibleMetrics]);

  const toggleMetric = (id: string) => {
    setVisibleMetrics((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const exportCSV = () => {
    const headers = "Metric,Value,Trend\n";
    const rows = SUMMARY_TABLE.map((r) => `${r.metric},${r.value},${r.change}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `phaos-analytics-${dateRange}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const handleExport = (fmt: string) => {
    if (fmt === "csv") { exportCSV(); return; }
    toast.info(`${fmt.toUpperCase()} export coming soon`);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-primary" />
          <h2 className="text-xl font-bold text-foreground tracking-tight">Analytics & ROI</h2>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Date Range */}
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px] bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {dateRange === "custom" && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    {customStart ? format(customStart, "MMM d") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    {customEnd ? format(customEnd, "MMM d") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Metric Picker */}
          <Button variant="outline" size="sm" onClick={() => setShowMetricPicker(!showMetricPicker)} className="text-xs">
            <Check size={14} className="mr-1" /> Metrics ({visibleMetrics.length})
          </Button>

          {/* Export */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                <Download size={14} className="mr-1" /> Export
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end">
              {["CSV", "Excel", "PDF", "Google Sheets", "Word", "PowerPoint", "Pages"].map((fmt) => (
                <button key={fmt} onClick={() => handleExport(fmt.toLowerCase())} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary/50 rounded transition-colors">
                  {fmt}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Metric Picker Panel */}
      {showMetricPicker && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-card p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Toggle Visible Metrics</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {ALL_METRICS.map((m) => (
              <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <Checkbox checked={visibleMetrics.includes(m.id)} onCheckedChange={() => toggleMetric(m.id)} />
                {m.label}
              </label>
            ))}
          </div>
        </motion.div>
      )}

      {mode === "live" ? (
        <LiveModeEmpty
          title="No analytics data yet"
          description="Performance metrics, savings, and call distribution charts will appear here once this customer starts handling live calls."
        />
      ) : (
      <>
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {ALL_METRICS.filter((m) => visibleMetrics.includes(m.id)).map((m) => (
          <div key={m.id} className="glass-card p-4 hover-lift">
            <p className="text-xl font-bold text-foreground tabular-nums">{m.value}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">{m.label}</p>
            <p className="text-[10px] text-primary font-bold mt-1">{m.trend}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid — 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-6">Weekly Call Volume</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={WEEKLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(260 15% 14%)" />
              <XAxis dataKey="day" stroke="hsl(260 10% 50%)" fontSize={10} />
              <YAxis stroke="hsl(260 10% 50%)" fontSize={10} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              <Bar dataKey="calls" fill="hsl(270 70% 55%)" radius={[4, 4, 0, 0]} name="Total Calls" />
              <Bar dataKey="deflected" fill="hsl(160 60% 45%)" radius={[4, 4, 0, 0]} name="AI Deflected" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-6">Call Outcome Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {PIE_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Line Chart */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-6">Cumulative Savings ($)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={WEEKLY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(260 15% 14%)" />
              <XAxis dataKey="day" stroke="hsl(260 10% 50%)" fontSize={10} />
              <YAxis stroke="hsl(260 10% 50%)" fontSize={10} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="savings" stroke="hsl(270 70% 55%)" strokeWidth={2} dot={{ fill: "hsl(265 85% 65%)", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Numeric Summary Table */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4">Performance Summary</h3>
          <div className="overflow-auto max-h-[260px] custom-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left text-[10px] text-muted-foreground uppercase tracking-widest pb-2">Metric</th>
                  <th className="text-right text-[10px] text-muted-foreground uppercase tracking-widest pb-2">Value</th>
                  <th className="text-right text-[10px] text-muted-foreground uppercase tracking-widest pb-2">Change</th>
                </tr>
              </thead>
              <tbody>
                {SUMMARY_TABLE.map((row, i) => (
                  <tr key={i} className="border-b border-border/10">
                    <td className="py-2.5 text-foreground">{row.metric}</td>
                    <td className="py-2.5 text-right text-foreground font-mono tabular-nums">{row.value}</td>
                    <td className={`py-2.5 text-right font-mono font-bold tabular-nums ${
                      row.status === "up" ? (row.change.startsWith("-") ? "text-primary" : "text-primary") : "text-primary"
                    }`}>{row.change}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </>
      )}
    </motion.div>
  );
}
