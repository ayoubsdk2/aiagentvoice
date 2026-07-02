import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock, Bot, User, Wrench, Droplets, FileText, ChevronDown, ChevronUp, Download, Calendar as CalendarIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { scrubPII } from "@/lib/pii-scrubber";
import { exportRowsAsCsv } from "@/lib/csv-export";
import { useAccountMode } from "@/contexts/AccountModeContext";
import { LiveModeEmpty } from "./LiveModeEmpty";

const TIME_RANGES = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Last 90 days", "All time"];

interface ToolCallEntry {
  tool: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
}

interface TranscriptMessage {
  role: "user" | "agent";
  content: string;
  timestamp: string;
  toolCall?: ToolCallEntry;
}

interface CallRecord {
  id: string;
  caller: string;
  device: string;
  intent: string;
  duration: string;
  date: string;
  status: "completed" | "escalated" | "dropped";
  transcript: TranscriptMessage[];
}

const TOOL_ICONS: Record<string, typeof Wrench> = {
  trigger_service_dispatch: Wrench,
  verify_toner_levels: Droplets,
  collect_meter_reading: FileText,
};

const TOOL_LABELS: Record<string, string> = {
  trigger_service_dispatch: "Service Dispatch",
  verify_toner_levels: "Toner Check",
  collect_meter_reading: "Meter Reading",
};

const MOCK_CALLS: CallRecord[] = [
  {
    id: "CALL-001",
    caller: "+1 (555) 012-2431",
    device: "MX-M365N",
    intent: "Service",
    duration: "4:23",
    date: "2026-03-18 09:14 AM",
    status: "completed",
    transcript: [
      { role: "agent", content: "Good morning, thank you for calling SOA. This is Phoebe, your Technical Operations Architect. How can I help you today?", timestamp: "0:00" },
      { role: "user", content: "Hi Phoebe, we've got a Sharp M X M three sixty five N that's throwing an E7-10 error. The whole office is down.", timestamp: "0:05" },
      { role: "agent", content: "I completely understand how frustrating that is — every minute of downtime impacts your team. Let me look that up right away. Please provide the Asset ID number found on the silver Smart Office sticker on the front of the device.", timestamp: "0:12" },
      { role: "user", content: "Yeah, it's SHP-MX365N-00412.", timestamp: "0:20" },
      {
        role: "agent",
        content: "One moment while I query E-Automate... I've pulled the telemetry — last service call was 62 days ago. I've dispatched a technician to your location. Mike Reynolds is en route with an ETA of about 45 minutes.",
        timestamp: "0:24",
        toolCall: {
          tool: "trigger_service_dispatch",
          params: { serial_number: "SHP-MX365N-00412", error_code: "E7-10" },
          result: { dispatch_id: "DSP-M1K4X7", technician: { name: "Mike Reynolds", rating: 4.9 }, eta_minutes: 45, priority: "critical" },
        },
      },
      { role: "user", content: "That's great, thank you so much Phoebe.", timestamp: "0:35" },
      { role: "agent", content: "You're welcome! Mike will call you 10 minutes before he arrives. Is there anything else I can help with?", timestamp: "0:38" },
      { role: "user", content: "No, that's all. Thanks!", timestamp: "0:42" },
      { role: "agent", content: "Have a great day. We'll follow up after the service visit to make sure everything is running smoothly.", timestamp: "0:44" },
    ],
  },
  {
    id: "CALL-002",
    caller: "+1 (555) 089-9120",
    device: "BP-70C45",
    intent: "Toner",
    duration: "2:51",
    date: "2026-03-18 10:02 AM",
    status: "completed",
    transcript: [
      { role: "agent", content: "SOA Technical Support, this is Phoebe. How can I assist you?", timestamp: "0:00" },
      { role: "user", content: "Hey, our B P seventy C forty five is printing really faded. I think we're low on toner.", timestamp: "0:04" },
      { role: "agent", content: "Let me pull that from Sales Chain to check your supply levels...", timestamp: "0:08" },
      {
        role: "agent",
        content: "I can see your black cartridge is at 8% and magenta is at 12% — both below our auto-replenishment threshold. I've triggered a shipment that should arrive within 24-48 hours.",
        timestamp: "0:12",
        toolCall: {
          tool: "verify_toner_levels",
          params: { device_id: "DEV-BP70C45-0087" },
          result: { levels: { black: 8, cyan: 67, magenta: 12, yellow: 45 }, replenishment_triggered: true, low_cartridges: ["black", "magenta"] },
        },
      },
      { role: "user", content: "Perfect, that's exactly what I needed. Thanks!", timestamp: "0:22" },
    ],
  },
  {
    id: "CALL-003",
    caller: "+1 (555) 043-3781",
    device: "MX-C304W",
    intent: "Billing",
    duration: "3:15",
    date: "2026-03-18 11:30 AM",
    status: "completed",
    transcript: [
      { role: "agent", content: "Good morning, SOA Technical Support. Phoebe speaking.", timestamp: "0:00" },
      { role: "user", content: "Hi, I need to submit our monthly meter reading. Serial is SHP-MXC304W-01155 and the B&W counter reads 45,230.", timestamp: "0:05" },
      {
        role: "agent",
        content: "One moment while I query E-Automate... I've recorded your meter reading. That's 3,142 pages since your last reading — well within normal range. Your click rate is holding steady. You're all set for this month's billing cycle.",
        timestamp: "0:12",
        toolCall: {
          tool: "collect_meter_reading",
          params: { serial_number: "SHP-MXC304W-01155", bw_count: 45230 },
          result: { submitted_count: 45230, previous_count: 42088, is_valid: true, delta: 3142, validation_message: "Reading accepted. 3142 pages since last reading." },
        },
      },
      { role: "user", content: "Great, thanks Phoebe.", timestamp: "0:20" },
    ],
  },
];

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-accent/10 text-accent border-accent/30",
  escalated: "bg-warning/10 text-warning border-warning/30",
  dropped: "bg-destructive/10 text-destructive border-destructive/30",
};

export function CallHistory() {
  const { mode } = useAccountMode();
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("Last 30 days");

  const callList = useMemo(() => MOCK_CALLS, []);

  const handleExport = () => {
    const rows = callList.map((c) => ({
      id: c.id,
      caller: scrubPII(c.caller),
      device: c.device,
      intent: c.intent,
      duration: c.duration,
      date: c.date,
      status: c.status,
      transcript_excerpt: c.transcript.map((t) => `${t.role}: ${scrubPII(t.content)}`).join(" | "),
    }));
    exportRowsAsCsv(`phaos-call-history-${timeRange.toLowerCase().replace(/\s+/g, "-")}.csv`, rows);
    toast.success("Export complete", { description: `${rows.length} call records exported.` });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Call Transcript</h2>
          <p className="text-sm text-muted-foreground">Review transcripts with inline tool-call highlights.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <CalendarIcon size={14} />
                {timeRange}
                <ChevronDown size={12} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {TIME_RANGES.map((t) => (
                <DropdownMenuItem key={t} onClick={() => setTimeRange(t)}>
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download size={14} />
            Export
          </Button>
        </div>
      </div>

      {mode === "live" ? (
        <LiveModeEmpty
          title="No call transcripts yet"
          description="Recorded transcripts for this customer's voice agent will appear here as soon as calls are completed."
        />
      ) : (
      <div className="space-y-3" role="list" aria-label="Call history records">
        {callList.map((call) => {
          const isExpanded = expandedCall === call.id;
          return (
            <div key={call.id} className="glass-card overflow-hidden" role="listitem">
              <button
                onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                aria-expanded={isExpanded}
                aria-label={`${call.caller} — ${call.device} — ${call.intent}`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-secondary rounded-lg">
                    <Phone size={16} className="text-primary" aria-hidden="true" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{scrubPII(call.caller)}</span>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono border-border">
                        {call.intent}
                      </Badge>
                      <Badge className={`text-[9px] uppercase font-mono border ${STATUS_COLORS[call.status]}`}>
                        {call.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">{call.device}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock size={10} aria-hidden="true" /> {call.duration}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{call.date}</span>
                    </div>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp size={16} className="text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronDown size={16} className="text-muted-foreground" aria-hidden="true" />
                )}
              </button>

              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border/50 p-5 space-y-4 bg-secondary/10"
                  role="region"
                  aria-label={`Transcript for ${call.id}`}
                >
                  {call.transcript.map((msg, i) => (
                    <div key={i} className="space-y-2">
                      <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                          msg.role === "agent" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                        }`}>
                          {msg.role === "agent" ? <Bot size={14} aria-hidden="true" /> : <User size={14} aria-hidden="true" />}
                        </div>
                        <div className={`max-w-[75%] ${msg.role === "user" ? "text-right" : ""}`}>
                          <div className={`inline-block px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                            msg.role === "agent"
                              ? "bg-secondary text-foreground rounded-tl-sm"
                              : "bg-primary/10 text-foreground rounded-tr-sm"
                          }`}>
                            {scrubPII(msg.content)}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono mt-1 px-1">
                            {msg.timestamp}
                          </div>
                        </div>
                      </div>

                      {msg.toolCall && (
                        <div className="ml-10 p-3 bg-card border border-primary/20 rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const Icon = TOOL_ICONS[msg.toolCall.tool] || Wrench;
                              return <Icon size={12} className="text-primary" aria-hidden="true" />;
                            })()}
                            <Badge className="bg-primary/10 text-primary border-primary/30 text-[9px] font-mono uppercase">
                              ⚡ Tool Call: {TOOL_LABELS[msg.toolCall.tool] || msg.toolCall.tool}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div>
                              <span className="text-muted-foreground block mb-0.5">Input</span>
                              <pre className="text-foreground bg-secondary/50 rounded p-1.5 overflow-x-auto">
                                {JSON.stringify(msg.toolCall.params, null, 1)}
                              </pre>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-0.5">Output</span>
                              <pre className="text-accent bg-secondary/50 rounded p-1.5 overflow-x-auto">
                                {JSON.stringify(msg.toolCall.result, null, 1)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </motion.div>
  );
}
