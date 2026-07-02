import { motion } from "framer-motion";
import { useState } from "react";
import { Mic2, Zap, BarChart3, Activity, ArrowUpRight, ArrowDownRight, Calendar, ChevronDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { MetricCard } from "./MetricCard";
import { ObservabilityWidget } from "./ObservabilityWidget";
import { scrubPII } from "@/lib/pii-scrubber";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { LiveModeEmpty } from "./LiveModeEmpty";

const TIME_RANGES = ["This Week", "Last Week", "Last 30 Days", "Last 90 Days", "This Year", "Custom"];

const PHAOS_PURPLE = "hsl(270 70% 55%)";

const INTENT_DATA = [
  { name: "Service", value: 45, color: PHAOS_PURPLE },
  { name: "Toner", value: 30, color: "hsl(260 10% 50%)" },
  { name: "Sales", value: 25, color: "hsl(0 0% 96%)" },
];

const LIVE_CALLS = [
  { time: "14:32:08", type: "inbound", id: "+1 (713) 555-0122", model: "MX-M365N", intent: "Service", error: "SC542", status: "AI Handling", priority: "P2" },
  { time: "14:31:45", type: "inbound", id: "+1 (832) 555-0899", model: "BP-70C45", intent: "Toner", error: null, status: "AI Resolved", priority: "P3" },
  { time: "14:30:12", type: "outbound", id: "+1 (281) 555-0433", model: "MX-B455W", intent: "Sales", error: null, status: "Transferred", priority: "P1" },
  { time: "14:28:56", type: "inbound", id: "+1 (713) 555-0741", model: "MX-C304W", intent: "Service", error: "SC322", status: "AI Handling", priority: "P2" },
  { time: "14:27:33", type: "inbound", id: "+1 (832) 555-0198", model: "MX-M905", intent: "Toner", error: null, status: "AI Resolved", priority: "P4" },
  { time: "14:25:10", type: "inbound", id: "+1 (281) 555-0567", model: "BP-50C55", intent: "Service", error: "SC541", status: "Escalated", priority: "P1" },
];

export function ExecutiveDashboard() {
  const { mode } = useAccountMode();
  const [timeRange, setTimeRange] = useState("Last 30 Days");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground tracking-tight">Global Dashboard</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Calendar size={14} />
              {timeRange}
              <ChevronDown size={12} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {TIME_RANGES.map((t) => (
              <DropdownMenuItem key={t} onClick={() => { setTimeRange(t); if (t === "Custom") toast.info("Custom date picker coming soon"); }}>
                {t}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {mode === "live" ? (
        <LiveModeEmpty
          title="No live activity yet"
          description="Once this customer's voice agents start handling calls, real-time metrics, the active call feed, and intent distribution will populate here."
        />
      ) : (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Total Call Volume" value="1,432" trend="+12.4%" icon={Mic2} />
        <MetricCard title="Deflection Rate / FCR" value="68.2%" trend="+5.1%" icon={Zap} />
        <MetricCard title="Estimated Savings" value="$14,205" trend="+$2.1k" icon={BarChart3} />
        <MetricCard title="Sales Leads Captured" value="42" trend="+8" icon={Activity} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card p-6 overflow-x-auto">
          <h3 className="text-sm font-bold text-foreground mb-6 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-status-pulse" />
            Active Live Calls
          </h3>
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="text-[10px] text-muted-foreground uppercase tracking-widest border-b border-border/30">
                <th className="pb-3">Time</th>
                <th className="pb-3">Direction</th>
                <th className="pb-3">Caller</th>
                <th className="pb-3">Model</th>
                <th className="pb-3">Intent</th>
                <th className="pb-3">Error</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Priority</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm text-muted-foreground">
              {LIVE_CALLS.map((call, i) => (
                <tr key={i} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                  <td className="py-4 font-mono text-xs text-muted-foreground">{call.time}</td>
                  <td className="py-4">
                    {call.type === "inbound" ? (
                      <ArrowDownRight size={14} className="text-[hsl(var(--success))]" />
                    ) : (
                      <ArrowUpRight size={14} className="text-primary" />
                    )}
                  </td>
                  <td className="py-4 font-mono text-sm">{scrubPII(call.id)}</td>
                  <td className="py-4 text-foreground font-medium text-sm">{call.model}</td>
                  <td className="py-4">
                    <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded text-[10px] uppercase font-bold text-primary">
                      {call.intent}
                    </span>
                  </td>
                  <td className="py-4 font-mono text-xs text-yellow-400">{call.error || "—"}</td>
                  <td className="py-4">
                    <span className={`text-xs font-medium ${
                      call.status === "AI Resolved" ? "text-[hsl(var(--success))]" :
                      call.status === "Escalated" ? "text-destructive" : "text-foreground"
                    }`}>{call.status}</span>
                  </td>
                  <td className="py-4">
                    <span className={`text-[10px] font-bold ${
                      call.priority === "P1" ? "text-destructive" :
                      call.priority === "P2" ? "text-yellow-400" : "text-muted-foreground"
                    }`}>{call.priority}</span>
                  </td>
                  <td className="py-4 text-right">
                    <button className="text-xs font-bold text-foreground bg-secondary px-4 py-1.5 rounded hover:bg-primary hover:text-primary-foreground transition-all btn-glow">
                      LISTEN LIVE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 flex flex-col items-center justify-center">
            <h3 className="text-sm font-bold text-foreground mb-6 uppercase tracking-widest self-start">
              Call Intent Distribution
            </h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={INTENT_DATA} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                  {INTENT_DATA.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(260 15% 8%)",
                    border: "1px solid hsl(260 15% 14%)",
                    borderRadius: "8px",
                    color: "#f5f5f5",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-4 w-full text-xs font-bold uppercase tracking-wider">
              {INTENT_DATA.map((d) => (
                <div key={d.name} className="flex flex-col items-center gap-1">
                  <span style={{ color: d.color }}>{d.name}</span>
                  <span className="text-foreground">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <ObservabilityWidget />
        </div>
      </div>
      </>
      )}
    </motion.div>
  );
}
