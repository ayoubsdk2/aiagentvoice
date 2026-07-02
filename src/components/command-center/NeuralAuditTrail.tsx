import { motion, AnimatePresence } from "framer-motion";
import { Shield, Cpu, Wifi, Activity, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";

const LATENCY_FILLERS = [
  "[Analyzing Print Specs...]",
  "[Neural Bridge Active...]",
  "[Querying MFP Knowledge Base...]",
  "[Cross-referencing Error Codes...]",
  "[Evaluating Toner Yield Data...]",
  "[Scanning Service History...]",
  "[Processing Voice Biometrics...]",
  "[Routing Through Voice Engine...]",
  "[Matching Firmware Revisions...]",
  "[Calculating Truck Roll Probability...]",
  "[Verifying Warranty Coverage...]",
  "[Analyzing Call Sentiment...]",
  "[Loading Sharp MFP Schematics...]",
  "[Parsing PCL/PS Driver Config...]",
  "[Optimizing Response Pipeline...]",
];

interface AuditEntry {
  id: number;
  timestamp: string;
  text: string;
  type: "status" | "latency" | "tool" | "pipeline" | "warning" | "spec";
}

interface NeuralAuditTrailProps {
  callActive: boolean;
  isSpeaking: boolean;
  latencyMs: number | null;
  volumeLevel: number;
  toolCalls: string[];
  structuredOutputs: string[];
  highLatency?: boolean;
  specAlerts: string[];
}

const TYPE_COLORS: Record<AuditEntry["type"], string> = {
  latency: "text-cyan-400",
  tool: "text-cyan-300 font-bold",
  pipeline: "text-cyan-500",
  status: "text-cyan-400/80",
  warning: "text-yellow-400 font-bold",
  spec: "text-emerald-400 font-bold",
};

export function NeuralAuditTrail({
  callActive,
  isSpeaking,
  latencyMs,
  volumeLevel,
  toolCalls,
  structuredOutputs,
  highLatency,
  specAlerts,
}: NeuralAuditTrailProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [fillerIdx, setFillerIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const now = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  const push = (text: string, type: AuditEntry["type"]) => {
    idRef.current += 1;
    setEntries((prev) => [...prev.slice(-60), { id: idRef.current, timestamp: now(), text, type }]);
  };

  useEffect(() => {
    if (!callActive || isSpeaking) return;
    const iv = setInterval(() => {
      setFillerIdx((i) => {
        const next = (i + 1) % LATENCY_FILLERS.length;
        push(LATENCY_FILLERS[next], "latency");
        return next;
      });
    }, 840);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive, isSpeaking]);

  useEffect(() => {
    if (callActive) push("SESSION_INIT :: Secure connection established", "pipeline");
    else if (entries.length > 0) push("SESSION_END :: Connection terminated", "pipeline");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callActive]);

  useEffect(() => {
    if (isSpeaking) push("TTS_STREAM :: Phaos voice engine active", "status");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking]);

  useEffect(() => {
    if (toolCalls.length > 0) {
      push(`TOOL_EXEC :: ${toolCalls[toolCalls.length - 1]}`, "tool");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolCalls.length]);

  useEffect(() => {
    if (structuredOutputs.length > 0) {
      push(`GOAL_MET :: [${structuredOutputs[structuredOutputs.length - 1]}]`, "tool");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuredOutputs.length]);

  useEffect(() => {
    if (highLatency) {
      push("⚠ High Network Latency Detected — Switching to Optimized Stream", "warning");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highLatency]);

  // Spec alerts from model detection
  const lastSpecCountRef = useRef(0);
  useEffect(() => {
    if (specAlerts.length > lastSpecCountRef.current) {
      const newAlerts = specAlerts.slice(lastSpecCountRef.current);
      for (const alert of newAlerts) {
        push(`📋 ${alert}`, "spec");
      }
      lastSpecCountRef.current = specAlerts.length;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specAlerts.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries]);

  const renderedEntries = useMemo(
    () =>
      entries.map((e) => (
        <motion.div
          key={e.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          className="font-mono text-sm leading-relaxed flex gap-2"
        >
          <span className="text-cyan-800 shrink-0">{e.timestamp}</span>
          <span className={TYPE_COLORS[e.type]}>{e.text}</span>
        </motion.div>
      )),
    [entries]
  );

  return (
    <div className="h-full rounded-xl border border-cyan-900/40 bg-[#050a0f] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-cyan-900/30 bg-[#0a1018] shrink-0">
        <Shield size={16} className="text-cyan-400" />
        <span className="font-mono text-sm font-bold text-cyan-400 uppercase tracking-[0.2em]">
          Activity Log
        </span>
        {callActive && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="ml-auto flex items-center gap-1.5 text-cyan-400 text-sm font-mono"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> RECORDING
          </motion.span>
        )}
      </div>

      {/* Metrics bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-cyan-900/20 bg-[#080e14] font-mono text-sm text-cyan-600 shrink-0">
        <div className="flex items-center gap-1">
          <Wifi size={14} />
          <span className={latencyMs !== null && latencyMs < 200 ? "text-green-400" : highLatency ? "text-yellow-400" : "text-cyan-400"}>
            {latencyMs !== null ? `${latencyMs}ms` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Activity size={14} />
          <span>VOL: {(volumeLevel * 100).toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <Cpu size={14} />
          <span>{callActive ? (isSpeaking ? "TX" : "RX") : "IDLE"}</span>
        </div>
        {highLatency && (
          <div className="flex items-center gap-1 text-yellow-400 ml-auto">
            <AlertTriangle size={14} />
            <span>HIGH LATENCY</span>
          </div>
        )}
      </div>

      {/* Scrolling log */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5" style={{ scrollbarWidth: "thin", scrollbarColor: "#164e63 transparent" }}>
        {entries.length === 0 ? (
          <p className="text-cyan-800 font-mono text-sm italic mt-2">
            Activity log activates on call start...
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {renderedEntries}
          </AnimatePresence>
        )}
        {callActive && (
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="text-cyan-400 font-mono text-sm"
          >
            █
          </motion.span>
        )}
      </div>
    </div>
  );
}
