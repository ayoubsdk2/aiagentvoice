import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search, Filter, Download, X, PhoneIncoming, ArrowUpRight, Clock,
  CheckCircle2, UserCog, Wrench, Cpu, AlertTriangle, Hash, Database,
  TableIcon, LayoutGrid, RefreshCw, Loader2, Lock, Sparkles, FileJson,
  FileSpreadsheet, ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  useCustomerCalls, maskPhone, type CallRow, type TranscriptDetail, type CallsFilters,
} from "@/hooks/useCustomerCalls";
import SampleLiveDashboard from "./SampleLiveDashboard";
import { AwaitingDataState } from "./AwaitingDataState";
import { useDemoMode } from "@/contexts/DemoModeContext";

/* ---------- URL <-> filter sync ---------- */
function readFiltersFromURL(): Partial<CallsFilters> {
  const p = new URLSearchParams(window.location.search);
  const out: Partial<CallsFilters> = {};
  const q = p.get("q"); if (q) out.q = q;
  const loc = p.get("loc"); if (loc) out.locationId = loc;
  const oc = p.get("outcome"); if (oc) out.outcome = oc;
  const r = p.get("res"); if (r === "ai" || r === "human" || r === "all") out.resolution = r;
  const rg = p.get("range");
  if (rg === "24h" || rg === "7d" || rg === "30d" || rg === "90d" || rg === "all") out.range = rg;
  return out;
}
function writeFiltersToURL(f: CallsFilters) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.locationId !== "all") p.set("loc", f.locationId);
  if (f.outcome !== "all") p.set("outcome", f.outcome);
  if (f.resolution !== "all") p.set("res", f.resolution);
  if (f.range !== "30d") p.set("range", f.range);
  const qs = p.toString();
  const url = qs ? `?${qs}` : window.location.pathname;
  window.history.replaceState({}, "", url);
}

/* ---------- Helpers ---------- */
function fmtDuration(sec: number | null): string {
  if (!sec || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return "—"; }
}
function outcomeColor(outcome: string | null): string {
  if (!outcome) return "bg-muted/40 text-muted-foreground border-border/40";
  const o = outcome.toLowerCase();
  if (o.includes("resolved") || o.includes("success")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (o.includes("transfer") || o.includes("escal")) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  if (o.includes("fail") || o.includes("dropped") || o.includes("abandon")) return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return "bg-primary/15 text-primary border-primary/30";
}

/* ---------- Page ---------- */
export default function CustomerCallsPage() {
  const initial = useMemo(() => readFiltersFromURL(), []);
  const {
    loading, error, role, caps, calls, locations, outcomes,
    filters, setFilters, resetFilters, refetch,
    fetchTranscript, logExport, logSensitiveView, orgId,
  } = useCustomerCalls(initial);

  const [view, setView] = useState<"table" | "cards">("table");
  const [active, setActive] = useState<CallRow | null>(null);
  const [transcript, setTranscript] = useState<TranscriptDetail | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  // persist filters to URL
  useEffect(() => { writeFiltersToURL(filters); }, [filters]);

  const { state: demoState } = useDemoMode();

  // Sample mode ON → show the chosen-scope sample dashboard.
  if (demoState.enabled) {
    return <SampleLiveDashboard scope={demoState.scope} />;
  }

  // Sample mode OFF + trial/no-tenant → empty state inviting sample preview.
  if (caps.sampleOnly) {
    return (
      <AwaitingDataState
        title="No calls yet"
        description="Every inbound and outbound call will appear here in real time once Phoebe is live on your phone numbers. Until then, preview a sample account to see what's coming."
      />
    );
  }

  if (!orgId && !loading) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/30 p-8 text-center">
        <Database className="mx-auto text-muted-foreground mb-3" size={28} />
        <div className="font-semibold">No organization assigned</div>
        <div className="text-sm text-muted-foreground mt-1">
          Your account isn't linked to an organization yet. Contact your administrator to be added.
        </div>
      </div>
    );
  }

  async function openCall(c: CallRow) {
    setActive(c);
    setTranscript(null);
    setTranscriptLoading(true);
    try {
      const t = await fetchTranscript(c.id);
      setTranscript(t);
      void logSensitiveView(c.id);
    } finally {
      setTranscriptLoading(false);
    }
  }

  function exportCSV() {
    if (!caps.canExport) { toast.error("You don't have permission to export"); return; }
    const headers = [
      "id","started_at","duration_sec","caller_phone","caller_name","location",
      "agent","phone","outcome","ai_resolved","transferred_to_human",
      "intent","serial_number","equipment_id","error_code","technician","crm_match",
    ];
    const rows = calls.map((c) => [
      c.id, c.started_at ?? "", c.duration_sec ?? "",
      maskPhone(c.caller_phone, caps.maskPII), c.caller_name ?? "",
      c.location_name ?? "", c.agent_name ?? "", c.phone_e164 ?? "",
      c.outcome ?? "", c.ai_resolved, c.transferred_to_human,
      c.intent ?? "", c.serial_number ?? "", c.equipment_id ?? "",
      c.error_code ?? "", c.technician_name ?? "", c.crm_match ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `calls-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    void logExport("csv", calls.length);
    toast.success(`Exported ${calls.length} calls`);
  }

  function exportJSON() {
    if (!caps.canExport) { toast.error("You don't have permission to export"); return; }
    const data = calls.map((c) => ({
      ...c, caller_phone: maskPhone(c.caller_phone, caps.maskPII),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `calls-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    void logExport("json", calls.length);
    toast.success(`Exported ${calls.length} calls`);
  }

  const hasActiveFilters =
    filters.q || filters.locationId !== "all" || filters.outcome !== "all" ||
    filters.resolution !== "all" || filters.range !== "30d";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <PhoneIncoming size={18} className="text-primary" />
            Calls & Transcripts
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Search, review, and export every call your AI agents handle. Tenant-scoped and audit-logged.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!caps.canExport || calls.length === 0}>
            <FileSpreadsheet size={14} /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportJSON} disabled={!caps.canExport || calls.length === 0}>
            <FileJson size={14} /> JSON
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-xl p-3">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-muted-foreground shrink-0 ml-1" />
          <input
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Search by serial #, caller, intent, equipment ID, error code, technician, CRM match…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X size={14} /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
        {/* Filter sidebar */}
        <aside className="space-y-4">
          <FilterGroup label="Time range">
            {(["24h","7d","30d","90d","all"] as const).map((r) => (
              <FilterPill key={r} active={filters.range === r} onClick={() => setFilters({ range: r })}>
                {r === "24h" ? "Last 24 hours" : r === "7d" ? "Last 7 days" :
                 r === "30d" ? "Last 30 days" : r === "90d" ? "Last 90 days" : "All time"}
              </FilterPill>
            ))}
          </FilterGroup>

          <FilterGroup label="Location">
            <FilterPill active={filters.locationId === "all"} onClick={() => setFilters({ locationId: "all" })}>
              All locations
            </FilterPill>
            {locations.map((l) => (
              <FilterPill key={l.id} active={filters.locationId === l.id} onClick={() => setFilters({ locationId: l.id })}>
                {l.name}
              </FilterPill>
            ))}
          </FilterGroup>

          <FilterGroup label="Resolution">
            {([
              { v: "all" as const, l: "Any" },
              { v: "ai" as const, l: "AI resolved" },
              { v: "human" as const, l: "Transferred to human" },
            ]).map((o) => (
              <FilterPill key={o.v} active={filters.resolution === o.v} onClick={() => setFilters({ resolution: o.v })}>
                {o.l}
              </FilterPill>
            ))}
          </FilterGroup>

          {outcomes.length > 0 && (
            <FilterGroup label="Outcome">
              <FilterPill active={filters.outcome === "all"} onClick={() => setFilters({ outcome: "all" })}>
                Any
              </FilterPill>
              {outcomes.map((o) => (
                <FilterPill key={o} active={filters.outcome === o} onClick={() => setFilters({ outcome: o })}>
                  {o}
                </FilterPill>
              ))}
            </FilterGroup>
          )}
        </aside>

        {/* Results */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Filter size={12} />
              {loading ? "Loading…" : `${calls.length} call${calls.length === 1 ? "" : "s"}`}
              {caps.maskPII && (
                <span className="ml-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-300">
                  <Lock size={10} /> PII masked
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border/40 p-0.5 bg-card/30">
              <button
                onClick={() => setView("table")}
                className={`p-1.5 rounded ${view === "table" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
                aria-label="Table view"
              >
                <TableIcon size={14} />
              </button>
              <button
                onClick={() => setView("cards")}
                className={`p-1.5 rounded ${view === "cards" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
                aria-label="Card view"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200 flex items-start gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : calls.length === 0 ? (
            <EmptyState />
          ) : view === "table" ? (
            <CallsTable calls={calls} onOpen={openCall} maskPII={caps.maskPII} />
          ) : (
            <CallsCards calls={calls} onOpen={openCall} maskPII={caps.maskPII} />
          )}
        </section>
      </div>

      {/* Detail sheet */}
      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-background border-border/40">
          {active && (
            <CallDetail
              call={active}
              transcript={transcript}
              loading={transcriptLoading}
              maskPII={caps.maskPII}
              canViewTools={caps.canViewRawTools}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ---------- Sidebar primitives ---------- */
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70 px-2 mb-1.5">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md border transition-colors truncate ${
        active
          ? "bg-primary/15 text-foreground border-primary/30 font-semibold"
          : "bg-transparent text-muted-foreground border-transparent hover:bg-secondary/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- Results: Table ---------- */
function CallsTable({ calls, onOpen, maskPII }: { calls: CallRow[]; onOpen: (c: CallRow) => void; maskPII: boolean }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">When</th>
              <th className="text-left px-3 py-2 font-semibold">Caller</th>
              <th className="text-left px-3 py-2 font-semibold">Location</th>
              <th className="text-left px-3 py-2 font-semibold">Intent</th>
              <th className="text-left px-3 py-2 font-semibold">Serial / Eq.</th>
              <th className="text-left px-3 py-2 font-semibold">Outcome</th>
              <th className="text-left px-3 py-2 font-semibold">Duration</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr
                key={c.id}
                onClick={() => onOpen(c)}
                className="border-t border-border/30 hover:bg-secondary/20 cursor-pointer"
              >
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtTime(c.started_at)}</td>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{c.caller_name || "Unknown"}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{maskPhone(c.caller_phone, maskPII)}</div>
                </td>
                <td className="px-3 py-2.5 text-xs">{c.location_name || "—"}</td>
                <td className="px-3 py-2.5 text-xs">{c.intent || "—"}</td>
                <td className="px-3 py-2.5 text-xs font-mono">
                  {c.serial_number || c.equipment_id || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${outcomeColor(c.outcome)}`}>
                    {c.outcome || "n/a"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{fmtDuration(c.duration_sec)}</td>
                <td className="px-3 py-2.5 text-right">
                  <ChevronRight size={14} className="text-muted-foreground inline" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Results: Cards ---------- */
function CallsCards({ calls, onOpen, maskPII }: { calls: CallRow[]; onOpen: (c: CallRow) => void; maskPII: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {calls.map((c) => (
        <motion.button
          key={c.id}
          whileHover={{ y: -2 }}
          onClick={() => onOpen(c)}
          className="text-left rounded-xl border border-border/40 bg-card/40 p-4 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="font-semibold text-sm">{c.caller_name || "Unknown caller"}</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                {maskPhone(c.caller_phone, maskPII)}
              </div>
            </div>
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${outcomeColor(c.outcome)}`}>
              {c.outcome || "n/a"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5"><Clock size={11} /> {fmtDuration(c.duration_sec)}</div>
            <div className="flex items-center gap-1.5"><Cpu size={11} /> {c.agent_name || "Agent"}</div>
            {c.location_name && <div className="flex items-center gap-1.5 truncate"><Hash size={11} /> {c.location_name}</div>}
            {c.intent && <div className="flex items-center gap-1.5 truncate"><Sparkles size={11} /> {c.intent}</div>}
            {c.serial_number && <div className="col-span-2 flex items-center gap-1.5"><Wrench size={11} /> SN: <span className="font-mono">{c.serial_number}</span></div>}
            {c.error_code && <div className="col-span-2 flex items-center gap-1.5 text-rose-300"><AlertTriangle size={11} /> {c.error_code}</div>}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">{fmtTime(c.started_at)}</div>
        </motion.button>
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */
function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border/40 bg-card/20 p-10 text-center">
      <PhoneIncoming className="mx-auto text-muted-foreground mb-3" size={28} />
      <div className="font-semibold">No calls match your filters</div>
      <div className="text-sm text-muted-foreground mt-1">
        Try widening the time range, clearing search, or selecting "All locations".
      </div>
    </div>
  );
}

/* ---------- Detail panel ---------- */
function CallDetail({
  call, transcript, loading, maskPII, canViewTools,
}: {
  call: CallRow; transcript: TranscriptDetail | null; loading: boolean;
  maskPII: boolean; canViewTools: boolean;
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <PhoneIncoming size={16} className="text-primary" />
          Call detail
        </SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-5">
        {/* Header summary */}
        <div className="rounded-lg border border-border/40 bg-card/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold">{call.caller_name || "Unknown caller"}</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">
                {maskPhone(call.caller_phone, maskPII)}
              </div>
            </div>
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${outcomeColor(call.outcome)}`}>
              {call.outcome || "n/a"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
            <KV icon={Clock} label="Started" value={fmtTime(call.started_at)} />
            <KV icon={Clock} label="Duration" value={fmtDuration(call.duration_sec)} />
            <KV icon={Cpu} label="Agent" value={call.agent_name || "—"} />
            <KV icon={Hash} label="Location" value={call.location_name || "—"} />
            <KV icon={PhoneIncoming} label="Number" value={call.phone_e164 || "—"} />
            <KV
              icon={CheckCircle2}
              label="Resolution"
              value={call.ai_resolved ? "AI resolved" : call.transferred_to_human ? "Transferred to human" : "—"}
            />
          </div>
        </div>

        {/* Metadata panel */}
        {(call.intent || call.serial_number || call.equipment_id || call.error_code || call.technician_name || call.crm_match) && (
          <div>
            <SectionLabel>Structured metadata</SectionLabel>
            <div className="rounded-lg border border-border/40 bg-card/30 p-4 grid grid-cols-2 gap-3 text-xs">
              {call.intent && <KV icon={Sparkles} label="Intent" value={call.intent} />}
              {call.serial_number && <KV icon={Wrench} label="Serial #" value={call.serial_number} mono />}
              {call.equipment_id && <KV icon={Database} label="Equipment ID" value={call.equipment_id} mono />}
              {call.error_code && <KV icon={AlertTriangle} label="Error code" value={call.error_code} mono />}
              {call.technician_name && <KV icon={UserCog} label="Technician" value={call.technician_name} />}
              {call.crm_match && <KV icon={ArrowUpRight} label="CRM match" value={call.crm_match} />}
            </div>
          </div>
        )}

        {/* Recording */}
        {call.recording_url && (
          <div>
            <SectionLabel>Recording</SectionLabel>
            <audio controls src={call.recording_url} className="w-full" />
          </div>
        )}

        {/* Transcript */}
        <div>
          <SectionLabel>Transcript</SectionLabel>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 size={14} className="animate-spin" /> Loading transcript…
            </div>
          ) : !transcript || (transcript.segments.length === 0 && !transcript.transcript_text) ? (
            <div className="text-sm text-muted-foreground py-4">No transcript available for this call.</div>
          ) : (
            <div className="rounded-lg border border-border/40 bg-card/20 p-3 space-y-2 max-h-[420px] overflow-y-auto">
              {transcript.segments.length > 0 ? (
                transcript.segments.map((seg, i) => <Segment key={i} seg={seg} canViewTools={canViewTools} />)
              ) : (
                <pre className="text-xs whitespace-pre-wrap text-foreground/90 font-sans">
                  {transcript.transcript_text}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Voice pipeline metrics if present */}
        {call.metadata && (call.metadata.stt_latency_ms || call.metadata.llm_latency_ms || call.metadata.tts_latency_ms) && (
          <div>
            <SectionLabel>Voice pipeline metrics</SectionLabel>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {call.metadata.stt_latency_ms != null && (
                <Metric label="STT" value={`${call.metadata.stt_latency_ms} ms`} />
              )}
              {call.metadata.llm_latency_ms != null && (
                <Metric label="LLM" value={`${call.metadata.llm_latency_ms} ms`} />
              )}
              {call.metadata.tts_latency_ms != null && (
                <Metric label="TTS" value={`${call.metadata.tts_latency_ms} ms`} />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
      {children}
    </div>
  );
}

function KV({
  icon: Icon, label, value, mono,
}: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1">
        <Icon size={10} /> {label}
      </div>
      <div className={`mt-0.5 text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function Segment({ seg, canViewTools }: { seg: any; canViewTools: boolean }) {
  const isTool = seg.tool || seg.speaker === "tool";
  if (isTool) {
    return (
      <div className="rounded border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-primary font-semibold mb-1">
          <Database size={11} /> Tool call{seg.tool?.name ? `: ${seg.tool.name}` : ""}
        </div>
        {canViewTools ? (
          <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-mono">
            {JSON.stringify(seg.tool ?? { text: seg.text }, null, 2)}
          </pre>
        ) : (
          <div className="text-[11px] text-muted-foreground italic flex items-center gap-1">
            <Lock size={10} /> Tool payload hidden by policy
          </div>
        )}
      </div>
    );
  }
  const speaker = seg.speaker || "system";
  const isAgent = speaker === "agent";
  return (
    <div className={`flex gap-2 ${isAgent ? "" : "flex-row-reverse"}`}>
      <Badge
        variant="outline"
        className={`shrink-0 h-5 text-[9px] uppercase tracking-wider ${
          isAgent ? "border-primary/40 text-primary" : "border-border/60 text-muted-foreground"
        }`}
      >
        {speaker}
      </Badge>
      <div className={`text-sm leading-relaxed ${isAgent ? "text-foreground" : "text-foreground/90"}`}>
        {seg.text}
      </div>
    </div>
  );
}
