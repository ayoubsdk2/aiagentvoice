/**
 * VapiSandbox is intentionally MODE-AGNOSTIC.
 *
 * Per product decision (Prompt 2 — hybrid scope):
 *   - In BOTH prototype and live modes, the Sandbox uses the shared demo
 *     VAPI assistant configuration. It MUST NOT bind to the live customer's
 *     real CRM/ERP credentials, real phone numbers, or real billing.
 *   - This protects live customers from accidental Sandbox calls hitting
 *     their production integrations.
 *   - Live data flows through the production orchestrator pipeline only,
 *     not from this Sandbox surface.
 */
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneOff, Loader2, Brain, Database, HardDrive,
  Zap, CheckCircle2, Send, AlertTriangle, Radio, Sparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NeuralAuditTrail } from "./NeuralAuditTrail";
import { useVapi, setVoiceAgentOverride } from "@/hooks/use-vapi";
import { scrubPII } from "@/lib/pii-scrubber";
import { useSandboxIndustry } from "@/contexts/SandboxIndustryContext";
import { useSandboxVoice } from "@/contexts/SandboxVoiceContext";


const STRESS_TOGGLES = [
  { id: "noise", label: "Heavy Background Noise", desc: "Simulate office environment" },
  { id: "angry", label: "Angry Caller Sentiment", desc: "Test empathy & de-escalation" },
  { id: "throttle", label: "Throttle Connection", desc: "Simulate 3G latency (+1.5s)" },
  { id: "technical", label: "Technical Jargon Overload", desc: "MFP internals, PCL/PS drivers" },
  { id: "multilang", label: "Multi-language Caller", desc: "Language switching mid-call" },
  { id: "rapid", label: "Rapid-fire Questions", desc: "Multiple questions at once" },
  { id: "silence", label: "Long Silence Periods", desc: "Extended pauses from caller" },
  { id: "mumbled", label: "Mumbled / Unclear Speech", desc: "Garbled audio simulation" },
] as const;

/**
 * Feature flag for the outbound "Live Phone Test" widget.
 * Set to `true` to restore the widget in the Sandbox UI. All handler code,
 * state, and the `vapi-outbound-call` edge function are intentionally kept intact
 * so flipping this single constant fully re-enables the feature.
 */
const SHOW_LIVE_PHONE_TEST = false;

// Per-industry recommended scenarios now live in src/lib/industries.ts and are
// resolved at render time via the SandboxIndustryContext.


export function VapiSandbox() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    noise: false, angry: false, throttle: false, technical: false,
    multilang: false, rapid: false, silence: false, mumbled: false,
  });
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCallLoading, setPhoneCallLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const reasoningScrollRef = useRef<HTMLDivElement>(null);

  const { industry } = useSandboxIndustry();
  const { voiceId, voice } = useSandboxVoice();
  const recommendedScenarios = industry.questions;

  const {
    callActive, callConnecting, isSpeaking, volumeLevel,
    transcript, reasoning, callDuration, latencyMs,
    structuredOutputs, highLatency, isResetting, specAlerts,
    liveQueryActive, startCall, endCall, formatTime,
  } = useVapi({
    industry: industry.name,
    industryAddendum: industry.systemPromptAddendum,
    greeting: industry.greeting,
    voiceId,
    voiceGender: voice?.gender ?? null,
  });


  // Per-industry Retell agent override (e.g. Document Solutions uses its own
  // dedicated agent). Falls back to the universal sandbox agent otherwise.
  useEffect(() => {
    setVoiceAgentOverride({ assistantId: industry.raw.retellAgentId ?? null });
  }, [industry.raw.retellAgentId]);


  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    if (reasoningScrollRef.current) reasoningScrollRef.current.scrollTop = reasoningScrollRef.current.scrollHeight;
  }, [reasoning]);

  const handlePhoneCall = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phoneNumber.trim()) { toast.error("Enter a phone number"); return; }
    setPhoneCallLoading(true);

    // Bundle outbound call payload with voice params and stress toggles
    const outboundPayload = {
      phoneNumber: phoneNumber.trim(),
      stressToggles: toggles,
      // Voice parameters will be read from centralized state when backend is wired
    };
    console.log("[Phaos] Outbound call payload:", outboundPayload);

    try {
      // Outbound calls are now routed through the Retell platform via the
      // backend provisioning queue; this widget remains feature-flagged off.
      toast.info("Outbound calling has moved to the Retell platform.");
    } finally {
      setPhoneCallLoading(false);
    }
  }, [phoneNumber, toggles]);

  const callStatus = callConnecting
    ? "Connecting..."
    : callActive
      ? isSpeaking ? "Agent Speaking" : "Listening..."
      : "Ready";

  const orbScale = 1 + volumeLevel * 0.4;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 h-full">
      {/* High Latency Banner */}
      {highLatency && callActive && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-mono text-xs"
          role="alert"
          aria-live="polite"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>High Network Latency Detected. Switching to Optimized Stream</span>
        </motion.div>
      )}

      {/* Live Query Indicator */}
      {liveQueryActive && callActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/30 font-mono text-xs"
          role="status"
          aria-live="polite"
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          >
            <Radio size={16} className="text-primary" aria-hidden="true" />
          </motion.div>
          <span className="text-primary font-bold">LIVE QUERY</span>
          <span className="text-muted-foreground">Querying external systems...</span>
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 max-w-7xl">
        {/* Left Column: Call Control + Phone Test */}
        <div className="flex flex-col gap-4 w-full lg:w-[360px] shrink-0">
          {/* Call Control Orb */}
          <div className="flex flex-col items-center glass-card p-6 relative overflow-hidden" role="region" aria-label="Voice call controls">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.12),transparent_70%)]" />

            <motion.div
              animate={{ scale: callActive ? orbScale : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-32 h-32 rounded-full border-2 border-primary/40 flex items-center justify-center relative z-10 cursor-pointer"
              style={{
                background: callActive
                  ? `radial-gradient(circle, hsl(var(--primary) / ${0.2 + volumeLevel * 0.3}), transparent 70%)`
                  : "transparent",
                boxShadow: callActive
                  ? `0 0 ${20 + volumeLevel * 40}px hsl(var(--primary) / ${0.3 + volumeLevel * 0.4})`
                  : "0 0 20px hsl(var(--primary) / 0.1)",
              }}
              aria-label={callActive ? `Call active — ${callStatus}` : "Call inactive"}
            >
              {callActive && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.2 + volumeLevel * 0.3, 1], opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-primary/30"
                  />
                  <motion.div
                    animate={{ scale: [1.1, 1.4 + volumeLevel * 0.2, 1.1], opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    className="absolute inset-[-12px] rounded-full border border-primary/20"
                  />
                  {isSpeaking && (
                    <motion.div
                      animate={{ scale: [1.2, 1.5, 1.2], opacity: [0.15, 0.35, 0.15] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="absolute inset-[-24px] rounded-full border border-accent/20"
                    />
                  )}
                </>
              )}

              <div className="relative z-10">
                {callConnecting ? (
                  <Loader2 size={36} className="text-primary animate-spin" aria-hidden="true" />
                ) : callActive ? (
                  <motion.div
                    animate={{ scale: isSpeaking ? [1, 1.1, 1] : 1 }}
                    transition={{ duration: 0.5, repeat: isSpeaking ? Infinity : 0 }}
                  >
                    <Phone size={36} className={isSpeaking ? "text-accent" : "text-primary"} aria-hidden="true" />
                  </motion.div>
                ) : (
                  <Phone size={36} className="text-primary/60" aria-hidden="true" />
                )}
              </div>
            </motion.div>

            <h2 className="mt-4 text-base font-bold text-foreground tracking-tight text-center z-10">
              Phaos AI Voice Agent
            </h2>

            <p className="text-muted-foreground text-sm text-center mt-1 max-w-[240px] z-10">
              {callActive ? callStatus : "Ready to demonstrate."}
            </p>
            {callActive && (
              <div className="mt-2 font-mono text-sm text-primary tabular-nums z-10" aria-live="polite" aria-label={`Call duration: ${formatTime(callDuration)}`}>
                {formatTime(callDuration)}
              </div>
            )}

            {!callActive ? (
              <button
                onClick={() => {
                  startCall().catch(() => {
                    toast.error("Failed to start call. Check microphone permissions in the address bar.");
                  });
                }}
                disabled={callConnecting || isResetting}
                aria-label="Start AI call"
                className="mt-4 w-full py-3 bg-gradient-phaos text-primary-foreground font-black uppercase tracking-widest rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all glow-primary z-10 btn-glow flex items-center justify-center gap-3 text-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                {callConnecting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Phone size={18} aria-hidden="true" />}
                {callConnecting ? "Connecting..." : isResetting ? "Resetting..." : "Start AI Call"}
              </button>
            ) : (
              <button
                onClick={endCall}
                disabled={!callActive}
                aria-label="End call"
                className="mt-4 w-full py-3 bg-destructive text-destructive-foreground font-black uppercase tracking-widest rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all z-10 flex items-center justify-center gap-3 text-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                <PhoneOff size={18} aria-hidden="true" /> End Call
              </button>
            )}

            {structuredOutputs.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 z-10">
                {structuredOutputs.map((badge) => (
                  <motion.div
                    key={badge}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30 text-sm font-bold text-primary"
                  >
                    <CheckCircle2 size={12} aria-hidden="true" /> {badge}
                  </motion.div>
                ))}
              </div>
            )}
          </div>





          {/*
            Live Phone Test — TEMPORARILY HIDDEN (2026-04).
            To restore: set SHOW_LIVE_PHONE_TEST = true (or wire to a feature flag / env var).
            All handler logic (handlePhoneCall, phoneNumber, phoneCallLoading) is preserved
            above so the widget can be re-enabled with no further changes.
          */}
          {SHOW_LIVE_PHONE_TEST && (
            <form onSubmit={handlePhoneCall} className="glass-card p-4 space-y-3" role="region" aria-label="Outbound phone test">
              <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px] border-b border-border/30 pb-2">
                <Zap size={12} className="text-primary" aria-hidden="true" /> LIVE PHONE TEST
              </div>
              <p className="text-[10px] text-muted-foreground">
                Test outbound calling — connect Phoebe to your phone.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="+1 (555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="text-sm font-mono bg-secondary/50 border-border/30"
                  aria-label="Phone number for outbound call"
                />
                <button
                  type="submit"
                  disabled={phoneCallLoading}
                  aria-label="Initiate outbound call"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                >
                  {phoneCallLoading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                </button>
              </div>
            </form>
          )}

          {/* Reasoning */}
          <div className="glass-card p-4 font-mono text-sm overflow-hidden flex flex-col h-[300px] lg:h-[280px]" role="log" aria-label="Reasoning log">
            <div className="flex items-center gap-2 text-muted-foreground mb-2 border-b border-border/30 pb-2 shrink-0 text-sm">
              <Brain size={14} className="text-primary" aria-hidden="true" /> Reasoning
            </div>
            <div ref={reasoningScrollRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
              {reasoning.length === 0 ? (
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                  <p className="text-muted-foreground italic text-sm mt-4">
                    Reasoning log activates during a live call...
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {reasoning.map((entry, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }} className="flex gap-2 items-start">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${entry.type === "intent" ? "bg-accent" : entry.type === "action" ? "bg-primary" : "bg-warning"}`} />
                      <div>
                        <span className="text-xs text-muted-foreground">{entry.timestamp}</span>
                        <p className="text-foreground/80 text-sm leading-relaxed">{entry.text}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div className="h-[280px]">
            <NeuralAuditTrail
              callActive={callActive}
              isSpeaking={isSpeaking}
              latencyMs={latencyMs}
              volumeLevel={volumeLevel}
              toolCalls={transcript.filter((t) => t.toolCall).map((t) => t.toolCall!.name)}
              structuredOutputs={structuredOutputs}
              highLatency={highLatency}
              specAlerts={specAlerts}
            />
          </div>
        </div>

        {/* Right Column: Transcript + JSON + Audit Trail */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">
          {/* Industry headline + Call Transcript */}
          <h2 className="gold-sparkle text-3xl md:text-5xl font-black tracking-tight leading-[1.2] pb-2">
            {industry.name}
          </h2>
          

          <div className="glass-card p-4 font-mono text-sm overflow-hidden flex flex-col h-[300px]" role="log" aria-label="Call transcript">
            <div className="flex items-center gap-2 text-muted-foreground mb-2 border-b border-border/30 pb-2 shrink-0 text-sm">
              <Database size={14} aria-hidden="true" /> Call Transcript

              {callActive && (
                <span className="ml-auto flex items-center gap-1.5 text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> LIVE
                </span>
              )}
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-2 text-primary/80 text-sm leading-relaxed">
              {transcript.length === 0 ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                  <p className="text-muted-foreground italic mt-4 text-sm">Press "Start AI Call" to begin...</p>
                </div>
              ) : (
                <AnimatePresence>
                  {transcript.map((entry, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                      <p>
                        <span className="text-muted-foreground">[{entry.timestamp}]</span>{" "}
                        {entry.role === "system" && <span className="text-muted-foreground">SYSTEM: {entry.text}</span>}
                        {entry.role === "ai" && <><span className="text-foreground">AGENT:</span> &quot;{scrubPII(entry.text)}&quot;</>}
                        {entry.role === "caller" && <><span className="text-accent">CALLER:</span> &quot;{scrubPII(entry.text)}&quot;</>}
                      </p>
                      {entry.toolCall && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="ml-6 mt-1 mb-1 p-2 rounded bg-primary/10 border border-primary/20 text-sm"
                        >
                          <span className="text-primary font-bold">⚡ {entry.toolCall.name}</span>
                          <div className="text-muted-foreground mt-1">
                            ARGS: {JSON.stringify(entry.toolCall.args)}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
              {callActive && (
                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                  _
                </motion.span>
              )}
            </div>
          </div>


          {/* Bottom row: Integrations + Session Status side by side on desktop */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Integrations summary (40%) */}
            <div className="glass-card p-4 space-y-3 h-[280px] w-full md:w-2/5 min-w-0 overflow-hidden flex flex-col" role="region" aria-label="Integrations">
              <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm border-b border-border/30 pb-2 shrink-0">
                <Database size={14} className="text-primary" aria-hidden="true" /> Integrations
              </div>
              <ul className="space-y-2 text-sm text-foreground/90 flex-1 overflow-y-auto custom-scrollbar pb-2">
                {industry.integrations.map((i) => (
                  <li key={i.acronym}>
                    <span className="font-bold text-primary">{i.acronym}</span> {i.title}
                  </li>
                ))}
              </ul>

              <p className="text-[13px] sm:text-xs italic text-muted-foreground leading-snug">
                *This demonstration operates as if these integrations are in place and able to sync in real-time.
              </p>
            </div>

            {/* Session Status Monitor (60%) */}
            <div className="glass-card p-4 font-mono text-sm overflow-hidden flex flex-col h-[280px] w-full md:w-3/5 min-w-0" role="region" aria-label="Session status monitor">
              <div className="flex items-center gap-2 text-muted-foreground mb-2 border-b border-border/30 pb-2 shrink-0">
                <HardDrive size={16} aria-hidden="true" /> Session Status
              </div>
              <pre className="text-primary/70 text-sm flex-1 overflow-y-auto custom-scrollbar">
{callActive
  ? JSON.stringify({
      session_active: true,
      agent: `Phaos AI Voice Agent - ${industry.name}`,
      transport: "PHAOS_SECURE_STREAM",
      call_duration: formatTime(callDuration),
      turns: transcript.filter((t) => t.role !== "system").length,
      latency_ms: latencyMs,
      connection_quality: highLatency ? "DEGRADED" : "OPTIMAL",
      structured_outputs: structuredOutputs,
      tool_calls: transcript.filter((t) => t.toolCall).map((t) => t.toolCall),
      stress_toggles: Object.entries(toggles).filter(([, v]) => v).map(([k]) => k),
      engine_state: isSpeaking ? "TTS_STREAMING" : "LISTENING",
      pipeline: { stt: "phaos_speech_recognition", llm: "phaos_reasoning_engine", tts: "phaos_voice_synthesis", transport: "phaos_secure_stream" },
    }, null, 2)
  : JSON.stringify({
      session_active: false,
      agent: `Phaos AI Voice Agent - ${industry.name}`,
      transport: "PHAOS_SECURE_STREAM",
      pipeline: { stt: "phaos_speech_recognition", llm: "phaos_reasoning_engine", tts: "phaos_voice_synthesis", transport: "phaos_secure_stream" },
      capabilities: ["trigger_service_dispatch", "verify_toner_levels", "book_service_call", "knowledge_retrieval", "query_erp", "query_crm", "query_rmm"],
      status: "READY",
    }, null, 2)}
              </pre>
            </div>
          </div>

          {/* Recommended Questions — full-width scenario library */}
          <div className="glass-card p-5 space-y-4" role="region" aria-label="Recommended questions">
            <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground font-mono text-sm border-b border-border/30 pb-3">
              <span className="flex items-center gap-2">
                <Sparkles size={14} className="text-primary" aria-hidden="true" /> RECOMMENDED QUESTIONS
              </span>
              <span className="text-sm normal-case tracking-normal">
                Click any scenario to copy, then read it aloud once the call connects.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
              {recommendedScenarios.map(({ label, prompt, note }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(prompt).catch(() => { /* clipboard blocked */ });
                    }
                    toast.success("Copied. Read it aloud once the call connects.");
                  }}
                  className="flex flex-col text-left p-5 rounded-lg bg-secondary/40 hover:bg-primary/10 border border-border/30 hover:border-primary/40 transition-colors min-h-[180px]"
                  aria-label={`Use recommended question: ${label}`}
                >
                  <div className="text-sm font-mono uppercase tracking-wider text-primary/90 mb-2 leading-snug">
                    {label}
                  </div>
                  <div className="text-sm leading-relaxed text-foreground/90">
                    &ldquo;{prompt}&rdquo;
                  </div>
                  {note && (
                    <div className="mt-3 text-sm italic text-muted-foreground/80 leading-relaxed">
                      {note}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Stress-Test Toggles hidden — toggles state preserved for outbound call payload */}
    </motion.div>
  );
}


