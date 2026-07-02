import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { Database, CheckCircle2, Plug, Globe, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { LiveModeEmpty } from "./LiveModeEmpty";
import { INTEGRATION_DEFINITIONS, type IntegrationDefinition } from "@/lib/integration-registry";
import { LiveIntegrationToggle } from "./integrations/LiveIntegrationToggle";

type ToggleState = "off" | "pending" | "active";

interface ErpMetric { label: string; value: string; tip: string; color: "green" | "yellow" | "red" | "blue"; }
interface ErpDisplay { id: string; desc: string; metrics: ErpMetric[]; }

const AVAILABLE_DESCRIPTIONS: Record<string, string> = {
  zapier: "Connect 5,000+ apps via automated workflows",
  hubspot: "Push leads and call logs directly into HubSpot CRM",
  salesforce: "Enterprise CRM integration for lead injection",
  zendesk: "Ticket management and support pipeline sync",
  slack: "Real-time alerts and call summaries to channels",
  microsoft_teams: "Team notifications and call activity feeds",
  gohighlevel: "All-in-one marketing and CRM automation",
  sms_gateway: "SMS notifications and advanced telephony routing via your chosen carrier",
  sendgrid: "Transactional emails and campaign delivery",
  quickbooks: "Automated invoice generation and billing",
  docusign: "E-signature workflows for contracts and leases",
  papercut: "Print management and cost tracking",
  connectwise: "IT service management and ticketing",
  freshservice: "IT help desk and service delivery",
  servicenow: "Enterprise service management platform",
  cal_com: "Scheduling and appointment booking integration",
};

const ERP_DISPLAY: ErpDisplay[] = [
  {
    id: "sales_chain",
    desc: "CRM lead injection for lease renewals, equipment upsells, and managed print proposals.",
    metrics: [
      { label: "Leads Injected", value: "847", tip: "Total leads pushed to Sales Chain CRM in the selected period", color: "green" },
      { label: "Conversion Rate", value: "34.2%", tip: "Percentage of injected leads that converted to signed deals", color: "green" },
      { label: "Pipeline Value", value: "$1.2M", tip: "Total estimated value of active pipeline opportunities", color: "blue" },
    ],
  },
  {
    id: "eautomate",
    desc: "Service dispatch, technician routing, van stock management, and contract billing.",
    metrics: [
      { label: "Dispatches / Mo", value: "2,418", tip: "Service calls dispatched via EAutomate this period", color: "blue" },
      { label: "Avg Response", value: "2.4h", tip: "Average time from ticket creation to technician arrival", color: "yellow" },
      { label: "First-Fix Rate", value: "78%", tip: "Percentage of service calls resolved on the first visit", color: "green" },
    ],
  },
  {
    id: "sharp_odms",
    desc: "Online Device Management System — fleet telemetry, meter reads, and supply alerts.",
    metrics: [
      { label: "Devices Monitored", value: "1,284", tip: "Active Sharp MFPs reporting telemetry to ODMS", color: "blue" },
      { label: "Avg Uptime", value: "99.7%", tip: "Average fleet uptime across all monitored devices", color: "green" },
      { label: "Auto-Orders / Mo", value: "312", tip: "Automatic supply orders triggered by low-toner alerts", color: "blue" },
    ],
  },
  {
    id: "printanista",
    desc: "Managed print services platform — device monitoring, cost tracking, and fleet optimization.",
    metrics: [
      { label: "Fleet Devices", value: "3,650", tip: "Total devices under Printanista management", color: "blue" },
      { label: "Cost Savings", value: "22%", tip: "Reduction in print costs compared to previous quarter", color: "green" },
      { label: "Alerts / Day", value: "48", tip: "Average daily alerts for supply, jam, and service issues", color: "yellow" },
    ],
  },
  {
    id: "remote_tech",
    desc: "Remote diagnostic and technician support platform for MFP troubleshooting.",
    metrics: [
      { label: "Remote Fixes", value: "612", tip: "Issues resolved remotely without dispatching a technician", color: "green" },
      { label: "Avg Resolution", value: "18min", tip: "Average time to resolve a remote diagnostic session", color: "green" },
      { label: "Escalation Rate", value: "11%", tip: "Percentage of remote sessions that required on-site escalation", color: "red" },
    ],
  },
  {
    id: "onedrive",
    desc: "Cloud document storage — scan-to-cloud, document workflows, and archival integration.",
    metrics: [
      { label: "Docs Synced", value: "24.8K", tip: "Documents synced to OneDrive in the selected period", color: "blue" },
      { label: "Storage Used", value: "1.2TB", tip: "Total cloud storage consumed by synced documents", color: "yellow" },
      { label: "Active Users", value: "186", tip: "Users who accessed OneDrive-connected workflows", color: "blue" },
    ],
  },
];

const METRIC_COLORS: Record<string, string> = {
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
  blue: "text-blue-400",
};

const ERP_DEFS = INTEGRATION_DEFINITIONS.filter((d) => d.kind === "erp");
const AVAILABLE_DEFS = INTEGRATION_DEFINITIONS.filter((d) => d.kind === "available");

/** Prototype mode: hypothetical 3-state toggle, never touches backend. */
function PrototypeAvailableGrid({ items }: { items: IntegrationDefinition[] }) {
  const [states, setStates] = useState<Record<string, ToggleState>>({});
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) =>
      i.displayName.toLowerCase().includes(q) ||
      (AVAILABLE_DESCRIPTIONS[i.id] ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const cycle = (id: string) => setStates((p) => {
    const cur = p[id] || "off";
    const next: ToggleState = cur === "off" ? "pending" : cur === "pending" ? "active" : "off";
    return { ...p, [id]: next };
  });

  const switchColor = (s: ToggleState) =>
    s === "active" ? "data-[state=checked]:bg-[hsl(var(--success))]"
    : s === "pending" ? "data-[state=checked]:bg-yellow-500" : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
          <Globe size={14} className="text-primary" /> Available Integrations
        </h3>
        <div className="relative w-48">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="text-xs bg-secondary/30 border-border/30 h-7 pl-7" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {filtered.map((item) => {
          const state = states[item.id] || "off";
          const isHovered = hovered === item.id;
          const showConfigure = state === "pending" || (state === "active" && isHovered);
          return (
            <div key={item.id} className="glass-card p-3 hover-lift flex flex-col justify-between gap-2"
              onMouseEnter={() => setHovered(item.id)} onMouseLeave={() => setHovered(null)}>
              <div>
                <p className="text-foreground font-bold text-xs">{item.displayName}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                  {AVAILABLE_DESCRIPTIONS[item.id] ?? ""}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Switch checked={state !== "off"} onCheckedChange={() => cycle(item.id)}
                    className={`scale-75 ${switchColor(state)}`} aria-label={`Toggle ${item.displayName}`} />
                  {state === "active" && <CheckCircle2 size={10} className="text-[hsl(var(--success))]" />}
                </div>
                {showConfigure && (
                  <button className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest border border-primary/30 text-primary rounded hover:bg-primary/10 transition-colors">
                    Configure
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Prototype mode: ERP cards with demo metrics + 3-state toggle. Local state only, no backend. */
function PrototypeErpGrid() {
  // Default all ERP integrations to "active" so existing demo metrics remain meaningful out of the box.
  const [states, setStates] = useState<Record<string, ToggleState>>(() =>
    Object.fromEntries(ERP_DISPLAY.map((i) => [i.id, "active" as ToggleState])),
  );

  const cycle = (id: string) => setStates((p) => {
    const cur = p[id] || "off";
    const next: ToggleState = cur === "off" ? "pending" : cur === "pending" ? "active" : "off";
    return { ...p, [id]: next };
  });

  const switchColor = (s: ToggleState) =>
    s === "active" ? "data-[state=checked]:bg-[hsl(var(--success))]"
    : s === "pending" ? "data-[state=checked]:bg-yellow-500" : "";

  const statusLabel = (s: ToggleState) =>
    s === "active" ? "Connected" : s === "pending" ? "Configuring" : "Disabled";

  return (
    <div>
      <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
        <Database size={14} className="text-primary" /> ERP & Industry
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ERP_DISPLAY.map((item) => {
          const def = ERP_DEFS.find((d) => d.id === item.id);
          if (!def) return null;
          const state = states[item.id] || "off";
          const isOff = state === "off";
          return (
            <div key={item.id} className="glass-card p-5 hover-lift flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-bold text-base">{def.displayName}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                  <p className="text-[10px] uppercase tracking-widest mt-2 text-muted-foreground">
                    Status: <span className={
                      state === "active" ? "text-[hsl(var(--success))]"
                      : state === "pending" ? "text-yellow-400" : "text-muted-foreground"
                    }>{statusLabel(state)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={state !== "off"}
                    onCheckedChange={() => cycle(item.id)}
                    className={switchColor(state)}
                    aria-label={`Toggle ${def.displayName}`}
                  />
                  {state === "active" && <CheckCircle2 size={14} className="text-[hsl(var(--success))]" />}
                </div>
              </div>
              <TooltipProvider>
                <div className={`grid grid-cols-3 gap-3 pt-3 border-t border-border/20 transition-opacity ${isOff ? "opacity-30" : ""}`}>
                  {item.metrics.map((m) => (
                    <Tooltip key={m.label}>
                      <TooltipTrigger asChild>
                        <div className="text-center cursor-help">
                          <p className={`text-2xl font-bold tabular-nums ${METRIC_COLORS[m.color]}`}>
                            {isOff ? "—" : m.value}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{m.label}</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-[220px]">{m.tip}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Live mode: each card uses the validating toggle, no demo metrics. */
function LiveIntegrationGrid({
  defs, title, icon: Icon, customerId, columns,
}: {
  defs: IntegrationDefinition[]; title: string; icon: typeof Plug;
  customerId: string; columns: "erp" | "available";
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
        <Icon size={14} className="text-primary" /> {title}
      </h3>
      <div className={
        columns === "erp"
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      }>
        {defs.map((def) => (
          <div key={def.id} className="glass-card p-4 hover-lift flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-bold text-sm">{def.displayName}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {AVAILABLE_DESCRIPTIONS[def.id] ?? def.testProcedure.description}
                </p>
              </div>
              <LiveIntegrationToggle def={def} customerId={customerId} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IntegrationMap() {
  const { mode, currentLiveCustomerId, liveAccount } = useAccountMode();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <div className="flex items-center gap-3">
        <Plug size={24} className="text-primary" />
        <h2 className="text-xl font-bold text-foreground tracking-tight">Integrations</h2>
      </div>

      {mode === "live" ? (
        currentLiveCustomerId ? (
          <>
            <p className="text-xs text-muted-foreground">
              Live mode · Toggles only turn green after the integration is fully configured and passes its connection test for{" "}
              <span className="text-foreground font-semibold">{liveAccount?.displayName}</span>.
            </p>
            <LiveIntegrationGrid defs={ERP_DEFS} title="ERP & Industry" icon={Database}
              customerId={currentLiveCustomerId} columns="erp" />
            <LiveIntegrationGrid defs={AVAILABLE_DEFS} title="Available Integrations" icon={Globe}
              customerId={currentLiveCustomerId} columns="available" />
          </>
        ) : (
          <LiveModeEmpty
            title="No live customer bound"
            description="Enter the access code in the top header to load this customer's integration status."
          />
        )
      ) : (
        <>
          <PrototypeErpGrid />
          <PrototypeAvailableGrid items={AVAILABLE_DEFS} />
        </>
      )}
    </motion.div>
  );
}
