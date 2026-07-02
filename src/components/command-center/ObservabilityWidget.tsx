import { memo, useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, Radio, Cpu, Clock, Wifi, Mic2 } from "lucide-react";

interface CallMetrics {
  e2eLatencyMs: number;
  sttLatencyMs: number;
  llmLatencyMs: number;
  ttsLatencyMs: number;
  sttProvider: string;
  llmModel: string;
  ttsProvider: string;
  callDurationSec: number;
  isLive: boolean;
  vadState: "listening" | "user_speaking" | "thinking_pause" | "agent_speaking";
}

function useSimulatedMetrics(): CallMetrics {
  const [metrics, setMetrics] = useState<CallMetrics>({
    e2eLatencyMs: 287,
    sttLatencyMs: 85,
    llmLatencyMs: 142,
    ttsLatencyMs: 60,
    sttProvider: "Neural STT v2",
    llmModel: "Phaos Neural Engine",
    ttsProvider: "Premium Voice v2.5",
    callDurationSec: 0,
    isLive: true,
    vadState: "listening",
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) => {
        const stt = Math.max(40, Math.min(150, prev.sttLatencyMs + (Math.random() * 20 - 10)));
        const llm = Math.max(80, Math.min(250, prev.llmLatencyMs + (Math.random() * 30 - 15)));
        const tts = Math.max(30, Math.min(100, prev.ttsLatencyMs + (Math.random() * 10 - 5)));
        const vadStates: CallMetrics["vadState"][] = ["listening", "user_speaking", "thinking_pause", "agent_speaking"];
        return {
          ...prev,
          sttLatencyMs: Math.round(stt),
          llmLatencyMs: Math.round(llm),
          ttsLatencyMs: Math.round(tts),
          e2eLatencyMs: Math.round(stt + llm + tts),
          callDurationSec: prev.callDurationSec + 2,
          vadState: Math.random() > 0.85 ? vadStates[Math.floor(Math.random() * 4)] : prev.vadState,
        };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return metrics;
}

const LatencyBar = memo(function LatencyBar({ label, value, max, icon: Icon }: { label: string; value: number; max: number; icon: React.ElementType }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = value < max * 0.5 ? "bg-success" : value < max * 0.75 ? "bg-warning" : "bg-destructive";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
        </div>
        <span className="text-xs font-mono text-foreground tabular-nums">{value}ms</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
      </div>
    </div>
  );
});

const VadIndicator = memo(function VadIndicator({ state }: { state: CallMetrics["vadState"] }) {
  const config: Record<CallMetrics["vadState"], { label: string; color: string; pulse: boolean }> = {
    listening: { label: "LISTENING", color: "bg-muted-foreground", pulse: false },
    user_speaking: { label: "USER SPEAKING", color: "bg-success", pulse: true },
    thinking_pause: { label: "THINKING PAUSE", color: "bg-warning", pulse: true },
    agent_speaking: { label: "AGENT SPEAKING", color: "bg-primary", pulse: true },
  };
  const { label, color, pulse } = config[state];
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${color} ${pulse ? "animate-status-pulse" : ""}`} />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
});

export const ObservabilityWidget = memo(function ObservabilityWidget() {
  const metrics = useSimulatedMetrics();
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
          <Activity size={14} className="text-primary" /> Voice Pipeline
        </h3>
        <div className="flex items-center gap-3">
          <VadIndicator state={metrics.vadState} />
          {metrics.isLive && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/20 rounded-full">
              <Radio size={10} className="text-primary animate-status-pulse" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{formatDuration(metrics.callDurationSec)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/30">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-primary" />
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">E2E Latency</span>
        </div>
        <span className={`text-2xl font-mono font-black tabular-nums ${metrics.e2eLatencyMs < 300 ? "text-success" : metrics.e2eLatencyMs < 500 ? "text-warning" : "text-destructive"}`}>
          {metrics.e2eLatencyMs}<span className="text-xs text-muted-foreground ml-1">ms</span>
        </span>
      </div>

      <div className="space-y-3">
        <LatencyBar label="STT" value={metrics.sttLatencyMs} max={200} icon={Mic2} />
        <LatencyBar label="LLM" value={metrics.llmLatencyMs} max={300} icon={Cpu} />
        <LatencyBar label="TTS" value={metrics.ttsLatencyMs} max={150} icon={Wifi} />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/30">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">STT</p>
          <p className="text-xs font-mono text-foreground">{metrics.sttProvider}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">LLM</p>
          <p className="text-xs font-mono text-foreground">{metrics.llmModel}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">TTS</p>
          <p className="text-xs font-mono text-foreground">{metrics.ttsProvider}</p>
        </div>
      </div>
    </motion.div>
  );
});
