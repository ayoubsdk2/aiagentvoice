import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  UserPlus, Building, CheckCircle2, RefreshCw,
  ArrowRightLeft, ToggleRight, UserCog, Mail, Phone, PhoneOff,
  FileText, Send, Download, Filter, Calendar, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

import { useAccountMode } from "@/contexts/AccountModeContext";
import { LiveModeEmpty } from "./LiveModeEmpty";

interface MockLead {
  id: string;
  scIcon: typeof UserPlus;
  scColor: string;
  scTooltip: string;
  name: string;
  company: string;
  summary: string;
  specs: string;
  urgency: "Critical" | "High" | "Medium" | "Low" | "Cold";
  urgencyBg: string;
  actionTaken: string;
  actionIcon: typeof Mail;
  scSync: "Yes" | "No" | "N/A";
}

const URGENCY_TOOLTIPS: Record<string, string> = {
  Critical: "Immediate revenue at risk. Competitor takeover imminent, lease expiring within 30 days, or explicit buyout request.",
  High: "Strong buying signal. New prospect with defined specs, competitive frustration, or high-volume requirements.",
  Medium: "Moderate interest. Existing relationship expansion, partial data, or needs further qualification.",
  Low: "Informational inquiry. Routine check, general product interest, or fully matched contact with no urgency.",
  Cold: "Minimal engagement. No specs provided, no company identified, or brochure-only request with no follow-up intent.",
};

const REPS = ["Marcus Cole", "Sarah Brooks", "James Nguyen", "Dana Price"];

const TIME_RANGES = ["This Week", "Last Week", "Last 30 Days", "Last 90 Days", "This Year", "Custom"];

const MOCK_LEADS: MockLead[] = [
  {
    id: "1", scIcon: UserPlus, scColor: "text-purple-400",
    scTooltip: "New Lead: No matching record found in Sales Chain. This contact was captured from a new inbound call and has not been previously entered into the CRM.",
    name: "John Wick", company: "Continental Inc.",
    summary: "Unhappy with current Ricoh service; lease expires in 30 days. Wants a buyout quote.",
    specs: "8 Color MFPs, 25k Vol.", urgency: "Critical",
    urgencyBg: "bg-red-500/20 border-red-500/30 text-red-400",
    actionTaken: "Forwarded to Marcus Cole with buyout quote request",
    actionIcon: Send, scSync: "No",
  },
  {
    id: "2", scIcon: Building, scColor: "text-blue-400",
    scTooltip: "Existing Account: This company already exists in Sales Chain, but this is a new contact or new request under that account.",
    name: "Bruce Wayne", company: "Wayne Ent.",
    summary: "Existing client opening a satellite office in Gotham. Needs fleet expansion.",
    specs: "3 Mono MFPs", urgency: "Medium",
    urgencyBg: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400",
    actionTaken: "Email sent to rep Sarah Brooks with expansion details",
    actionIcon: Mail, scSync: "No",
  },
  {
    id: "3", scIcon: CheckCircle2, scColor: "text-green-400",
    scTooltip: "Fully Matched: This contact and company are fully matched in Sales Chain. All records are up-to-date with no action required for CRM entry.",
    name: "Tony Stark", company: "Stark Industries",
    summary: "Routine check turned into inquiry about high-speed production units.",
    specs: "Pro-Series 120ppm", urgency: "Low",
    urgencyBg: "bg-green-500/20 border-green-500/30 text-green-400",
    actionTaken: "Provided product specs via AI; no rep escalation needed",
    actionIcon: FileText, scSync: "No",
  },
  {
    id: "4", scIcon: UserPlus, scColor: "text-purple-400",
    scTooltip: "New Lead: No matching record found in Sales Chain. This contact was captured from a new inbound call and has not been previously entered into the CRM.",
    name: "Unknown Caller", company: "—",
    summary: "Called asking for Sharp brochure. No specific fleet size mentioned.",
    specs: "Unknown", urgency: "Cold",
    urgencyBg: "bg-secondary/40 border-border/30 text-muted-foreground",
    actionTaken: "Call ended with no action taken",
    actionIcon: PhoneOff, scSync: "N/A",
  },
  {
    id: "5", scIcon: UserPlus, scColor: "text-purple-400",
    scTooltip: "New Lead: No matching record found in Sales Chain. This contact was captured from a new inbound call and has not been previously entered into the CRM.",
    name: "David Chen", company: "Chen & Associates LLP",
    summary: "New law firm move-in. High volume legal scanning requirements.",
    specs: "5 Color MFPs, 50k+ Scan/mo", urgency: "High",
    urgencyBg: "bg-red-500/20 border-red-500/30 text-red-400",
    actionTaken: "Forwarded to James Nguyen with scanning consultation",
    actionIcon: Send, scSync: "Yes",
  },
  {
    id: "6", scIcon: UserPlus, scColor: "text-purple-400",
    scTooltip: "New Lead: No matching record found in Sales Chain. This contact was captured from a new inbound call and has not been previously entered into the CRM.",
    name: "Sarah Connor", company: "[Company Unknown]",
    summary: "AI extracted name/phone but caller didn't provide company. Needs manual vetting.",
    specs: "Desktop Printer", urgency: "Medium",
    urgencyBg: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400",
    actionTaken: "Sent follow-up email requesting company details",
    actionIcon: Mail, scSync: "Yes",
  },
  {
    id: "7", scIcon: UserPlus, scColor: "text-purple-400",
    scTooltip: "New Lead: No matching record found in Sales Chain. This contact was captured from a new inbound call and has not been previously entered into the CRM.",
    name: "Mike Rodriguez", company: "Pacific Logistics",
    summary: "Frustrated with Konica Minolta downtime. Specifically asked about Sharp reliability.",
    specs: "2 Color MFPs", urgency: "High",
    urgencyBg: "bg-red-500/20 border-red-500/30 text-red-400",
    actionTaken: "Forwarded to Dana Price with competitive flip notes",
    actionIcon: Send, scSync: "Yes",
  },
];

function ToggleInfoButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1.5 align-middle">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 text-[9px] font-bold leading-none cursor-pointer hover:bg-purple-500/30 transition-colors"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-[280px] rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground leading-relaxed shadow-md">
          {text}
        </span>
      )}
    </span>
  );
}

type FilterKey = "scSync" | "urgency" | "contactType";

export function LeadsDashboard() {
  const { mode } = useAccountMode();
  const [roundRobin, setRoundRobin] = useState(false);
  const [managerOnly, setManagerOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [timeRange, setTimeRange] = useState("Last 30 Days");
  const [filters, setFilters] = useState<Record<FilterKey, string | null>>({
    scSync: null,
    urgency: null,
    contactType: null,
  });

  const handleRoundRobinChange = useCallback((checked: boolean) => {
    setRoundRobin(checked);
    if (checked) setManagerOnly(false);
  }, []);

  const handleManagerChange = useCallback((checked: boolean) => {
    setManagerOnly(checked);
    if (checked) setRoundRobin(false);
  }, []);

  const handleSync = useCallback(() => {
    setSyncing(true);
    const mode = managerOnly ? "Manager" : roundRobin ? "Round Robin" : "Database only";
    setTimeout(() => {
      setSyncing(false);
      toast.success("Sales Chain sync complete", { description: `7 leads validated • Mode: ${mode} • 0 duplicates found` });
    }, 2000);
  }, [roundRobin, managerOnly]);

  const handleExport = useCallback(() => {
    // Lazy import keeps initial bundle slim.
    import("@/lib/csv-export").then(({ exportRowsAsCsv }) => {
      const rows = MOCK_LEADS.map((l) => ({
        name: l.name,
        company: l.company,
        urgency: l.urgency,
        sc_sync: l.scSync,
        specs: l.specs,
        summary: l.summary,
        action_taken: l.actionTaken,
      }));
      exportRowsAsCsv(`phaos-leads-${timeRange.toLowerCase().replace(/\s+/g, "-")}.csv`, rows);
      toast.success("Export complete", { description: `${rows.length} leads exported.` });
    });
  }, [timeRange]);

  const setFilter = (key: FilterKey, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filteredLeads = useMemo(() => {
    return MOCK_LEADS.filter((lead) => {
      if (filters.scSync && lead.scSync !== filters.scSync) return false;
      if (filters.urgency && lead.urgency !== filters.urgency) return false;
      if (filters.contactType) {
        const type = lead.scIcon === UserPlus ? "New" : lead.scIcon === Building ? "Existing" : "Matched";
        if (type !== filters.contactType) return false;
      }
      return true;
    });
  }, [filters]);

  const highCount = MOCK_LEADS.filter((l) => l.urgency === "Critical" || l.urgency === "High").length;

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Lead Intelligence</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredLeads.length} leads captured • {highCount} high-urgency
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Time Range */}
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

          {/* Round Robin */}
          <div className="flex items-center gap-2 glass-card px-3 py-2">
            <ToggleRight size={14} className="text-primary" />
            <span className="text-xs font-medium text-foreground">Round Robin</span>
            <Switch checked={roundRobin} onCheckedChange={handleRoundRobinChange} aria-label="Toggle round robin" />
            <ToggleInfoButton text="Automated Lead Distribution: When enabled, 'Sync with Sales Chain' will automatically assign leads to the next available sales rep based on your predefined team rotation, ensuring zero-latency response times." />
          </div>

          {/* Manager */}
          <div className="flex items-center gap-2 glass-card px-3 py-2">
            <UserCog size={14} className="text-primary" />
            <span className="text-xs font-medium text-foreground">Manager</span>
            <Switch checked={managerOnly} onCheckedChange={handleManagerChange} aria-label="Toggle manager only" />
            <ToggleInfoButton text="Manager-Only Routing: When enabled, all leads are sent exclusively to the Sales Manager instead of being distributed via Round Robin. Use this for high-priority oversight or when the manager wants to personally triage all incoming leads." />
          </div>

          {/* Sync */}
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
              Sync with Sales Chain
            </Button>
            <ToggleInfoButton text="Triggers a bi-directional API sync. It refreshes existing customer data to prevent duplicate entries and ensures new leads are validated against the current Sales Chain database. If neither Round Robin nor Manager is selected, data simply drops into the database." />
          </div>

          {/* Export */}
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download size={14} />
            Export
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Filters:</span>

        {/* SC Sync Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              SC Sync{filters.scSync ? `: ${filters.scSync}` : ""}
              <ChevronDown size={10} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilter("scSync", null)}>All</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("scSync", "Yes")}>Yes</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("scSync", "No")}>No</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("scSync", "N/A")}>N/A</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Urgency Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              Urgency{filters.urgency ? `: ${filters.urgency}` : ""}
              <ChevronDown size={10} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilter("urgency", null)}>All</DropdownMenuItem>
            {["Critical", "High", "Medium", "Low", "Cold"].map((u) => (
              <DropdownMenuItem key={u} onClick={() => setFilter("urgency", u)}>{u}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Contact Type Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              Contact Type{filters.contactType ? `: ${filters.contactType}` : ""}
              <ChevronDown size={10} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilter("contactType", null)}>All</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("contactType", "New")}>New Lead</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("contactType", "Existing")}>Existing Account</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("contactType", "Matched")}>Fully Matched</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setFilters({ scSync: null, urgency: null, contactType: null })}>
            Clear all
          </Button>
        )}
      </div>

      {/* Table — prototype shows demo leads; live shows empty state until tenant data lands */}
      {mode === "live" ? (
        <LiveModeEmpty
          title="No leads captured yet"
          description="When this customer's voice agent starts capturing leads, they'll appear here scoped to their tenant."
        />
      ) : (
        <div className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-[40px] text-xs uppercase tracking-wider" />
                <TableHead className="text-xs uppercase tracking-wider">Contact</TableHead>
                <TableHead className="text-xs uppercase tracking-wider min-w-[240px]">
                  AI Summary
                  <ToggleInfoButton text="Direct extraction from the voice transcript using NLP to identify pain points, competitor names, and lease end-dates." />
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider">Specs</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-center">Urgency</TableHead>
                <TableHead className="text-xs uppercase tracking-wider min-w-[200px]">
                  Action Taken
                  <ToggleInfoButton text="Shows what the AI did with this lead: forwarded to a rep, sent an email, provided info directly, or ended the call with no action." />
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-center">
                  SC Sync
                  <ToggleInfoButton text="Indicates whether this contact has been synced to Sales Chain. Yes = already in database, No = pending sync, N/A = insufficient data to sync." />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const Icon = lead.scIcon;
                const ActionIcon = lead.actionIcon;
                return (
                  <TableRow key={lead.id} className="border-border/10 hover:bg-white/[0.02] transition-colors">
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span><Icon size={18} className={`${lead.scColor} cursor-help`} /></span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs max-w-[280px] leading-relaxed">
                            {lead.scTooltip}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground text-sm">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">{lead.company}</div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-foreground/80 leading-relaxed">{lead.summary}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">{lead.specs}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Badge className={`text-[10px] border cursor-help ${lead.urgencyBg}`}>
                                {lead.urgency}
                              </Badge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-[300px] leading-relaxed">
                            {URGENCY_TOOLTIPS[lead.urgency]}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <ActionIcon size={13} className="text-muted-foreground shrink-0" />
                        <span className="text-xs text-foreground/80">{lead.actionTaken}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] border ${
                        lead.scSync === "Yes" ? "bg-green-500/20 border-green-500/30 text-green-400" :
                        lead.scSync === "No" ? "bg-red-500/20 border-red-500/30 text-red-400" :
                        "bg-secondary/40 border-border/30 text-muted-foreground"
                      }`}>
                        {lead.scSync}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </motion.div>
  );
}
