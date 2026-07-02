/**
 * use-vapi.ts — Voice session hook for Phaos AI. Despite the legacy filename,
 * this implementation now drives the Retell AI WebRTC client. The public API
 * (`useVapi`, `setVoiceAgentOverride`, `UseVapiReturn`) is preserved verbatim
 * so all consuming components keep working through the platform cutover.
 *
 * Responsibilities:
 *  - Mint a Retell WebRTC access token via the `retell-access-token` edge fn.
 *  - Manage call lifecycle, transcript, tool-call audit, lead extraction,
 *    soft-reset watchdog, and live-query indicator.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { RetellWebClient } from "retell-client-js-sdk";
import { detectMfpModels, detectTerminology, formatSpecSummary } from "@/lib/sharp-mfp-specs";
import { SANDBOX_RETELL_AGENT_ID } from "@/lib/voice-defaults";

// ─── Types ──────────────────────────────────────────────────

export interface TranscriptEntry {
  role: "system" | "ai" | "caller";
  text: string;
  timestamp: string;
  toolCall?: { name: string; args: Record<string, unknown> };
}

export interface ReasoningEntry {
  text: string;
  timestamp: string;
  type: "intent" | "action" | "routing";
}

export interface UseVapiReturn {
  callActive: boolean;
  callConnecting: boolean;
  isSpeaking: boolean;
  volumeLevel: number;
  transcript: TranscriptEntry[];
  reasoning: ReasoningEntry[];
  callDuration: number;
  latencyMs: number | null;
  structuredOutputs: string[];
  highLatency: boolean;
  isResetting: boolean;
  specAlerts: string[];
  liveQueryActive: boolean;
  startCall: () => Promise<void>;
  endCall: () => void;
  formatTime: (s: number) => string;
}

// ─── Validation ─────────────────────────────────────────────

const LeadSchema = z.object({
  call_id: z.string().min(1),
  customer_name: z.string().default("Unknown"),
  customer_phone: z.string().nullable().optional(),
  customer_email: z.string().email().nullable().optional().or(z.literal(null)),
  print_specs: z.record(z.string(), z.string()).default({}),
  raw_excerpt: z.string().max(2000).optional(),
});

// ─── Constants ──────────────────────────────────────────────

const TIMEOUT_THRESHOLD_MS = 10_000;
const HIGH_LATENCY_THRESHOLD_MS = 1500;
const MAX_TRANSCRIPT_ENTRIES = 200;
const MAX_REASONING_ENTRIES = 200;
const LEAD_SAVE_MAX_RETRIES = 3;

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak = () => {};
}

let retellInstance: RetellWebClient | null = null;
let activeAgentId: string = SANDBOX_RETELL_AGENT_ID;

/**
 * Override the Retell agent used by the Sandbox. Pass null/undefined to reset
 * to the sandbox default. Takes effect on the next call start.
 * The `publicKey` option is accepted for backward compatibility but ignored —
 * Retell uses ephemeral access tokens minted server-side.
 */
export function setVoiceAgentOverride(opts: { assistantId?: string | null; publicKey?: string | null }): void {
  activeAgentId = opts.assistantId?.trim() || SANDBOX_RETELL_AGENT_ID;
}

// ─── Lead Extraction Helpers ────────────────────────────────

function extractLeadData(fullText: string): {
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  printSpecs: Record<string, string>;
  machineModel: string;
  assetId: string | null;
  customerIntent: string;
  leadScore: number;
} {
  const nameMatch = fullText.match(/(?:my name is|this is|i'm|i am|name's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  const phoneMatch = fullText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const assetIdMatch = fullText.match(/(?:asset\s*(?:id|number|#)?|sticker)[:\s]*([A-Za-z0-9\-]+)/i);
  const modelMatch = fullText.match(/(?:BP|MX|AR|DX)[-\s]?\w{2,10}/i);

  let customerIntent = "general_inquiry";
  const lower = fullText.toLowerCase();
  if (lower.includes("service") || lower.includes("error") || lower.includes("broken") || lower.includes("down")) customerIntent = "service_request";
  else if (lower.includes("toner") || lower.includes("supply") || lower.includes("cartridge")) customerIntent = "supply_order";
  else if (lower.includes("contract") || lower.includes("lease") || lower.includes("quote")) customerIntent = "contract_inquiry";
  else if (lower.includes("meter") || lower.includes("reading") || lower.includes("billing")) customerIntent = "meter_reading";

  const printSpecs: Record<string, string> = {};
  const sizeMatch = lower.match(/(?:paper size|page size|format)[:\s]*(a[34]|letter|legal|tabloid|ledger|11x17)/i);
  if (sizeMatch) printSpecs.paper_size = sizeMatch[1].toUpperCase();
  const volMatch = lower.match(/(\d{1,6}(?:,\d{3})*)\s*(?:pages?|prints?|copies?|sheets?)\s*(?:per|a|\/)\s*(?:month|day|week)/i);
  if (volMatch) printSpecs.monthly_volume = volMatch[0];
  if (lower.includes("color") && !lower.includes("monochrome")) printSpecs.color_mode = "Color";
  else if (lower.includes("monochrome") || lower.includes("black and white") || lower.includes("b&w")) printSpecs.color_mode = "Monochrome";
  if (lower.includes("duplex") || lower.includes("double-sided")) printSpecs.duplex = "Yes";

  const customerName = nameMatch ? nameMatch[1].trim() : "Unknown";
  const customerPhone = phoneMatch ? phoneMatch[0].trim() : null;
  const customerEmail = emailMatch ? emailMatch[0].trim() : null;

  let leadScore = 0;
  if (customerName !== "Unknown") leadScore += 10;
  if (customerPhone) leadScore += 10;
  if (customerEmail) leadScore += 10;
  if (printSpecs.paper_size) leadScore += 10;
  if (printSpecs.monthly_volume) leadScore += 20;
  if (printSpecs.color_mode) leadScore += 10;
  if (printSpecs.duplex) leadScore += 10;
  const volStr = printSpecs.monthly_volume || "";
  const volNum = parseInt(volStr.replace(/\D/g, ""), 10);
  if (!isNaN(volNum) && volNum > 5000) leadScore += 10;
  leadScore = Math.min(leadScore, 100);

  return {
    customerName, customerPhone, customerEmail, printSpecs,
    machineModel: modelMatch ? modelMatch[0].trim() : "Not identified",
    assetId: assetIdMatch ? assetIdMatch[1].trim() : null,
    customerIntent, leadScore,
  };
}

async function retryAsync<T>(fn: () => Promise<T>, maxRetries: number, baseDelayMs = 500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try { return await fn(); } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

// ─── Hook ───────────────────────────────────────────────────

export interface UseVapiOptions {
  /** Display name of the selected industry, forwarded as `industry` dynamic var. */
  industry?: string;
  /** Industry-specific addendum appended to the base system prompt. */
  industryAddendum?: string;
  /** Opening greeting line to bias the agent toward at call start. */
  greeting?: string;
  /** Optional Retell voice_id to apply as a per-call agent_override. */
  voiceId?: string | null;
  /** Gender of the selected voice — drives the spoken assistant name. */
  voiceGender?: string | null;
}

export function useVapi(options: UseVapiOptions = {}): UseVapiReturn {
  const [callActive, setCallActive] = useState(false);
  const [callConnecting, setCallConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [reasoning, setReasoning] = useState<ReasoningEntry[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [structuredOutputs, setStructuredOutputs] = useState<string[]>([]);
  const [highLatency, setHighLatency] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [specAlerts, setSpecAlerts] = useState<string[]>([]);
  const [liveQueryActive, setLiveQueryActive] = useState(false);

  const timerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutCheckRef = useRef<number | null>(null);
  const detectedModelsRef = useRef<Set<string>>(new Set());
  const liveQueryTimerRef = useRef<number | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const lastTranscriptLengthRef = useRef<number>(0);
  const optionsRef = useRef<UseVapiOptions>(options);
  optionsRef.current = options;


  const formatTime = useCallback(
    (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`,
    [],
  );

  const addReasoning = useCallback((text: string, type: ReasoningEntry["type"]) => {
    setReasoning((prev) => {
      const next = [...prev, { text, timestamp: new Date().toLocaleTimeString(), type }];
      return next.length > MAX_REASONING_ENTRIES ? next.slice(-MAX_REASONING_ENTRIES) : next;
    });
  }, []);

  const addTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => {
      const next = [...prev, entry];
      const capped = next.length > MAX_TRANSCRIPT_ENTRIES ? next.slice(-MAX_TRANSCRIPT_ENTRIES) : next;
      transcriptRef.current = capped;
      return capped;
    });
  }, []);

  useEffect(() => {
    if (callActive) {
      timerRef.current = window.setInterval(() => setCallDuration((p) => p + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callActive]);

  useEffect(() => {
    if (latencyMs !== null && latencyMs > HIGH_LATENCY_THRESHOLD_MS) {
      if (!highLatency) {
        setHighLatency(true);
        toast.warning("High Network Latency Detected — Switching to Optimized Stream");
        addReasoning("⚠ High latency detected — optimizing stream", "action");
      }
    } else if (highLatency && latencyMs !== null && latencyMs < HIGH_LATENCY_THRESHOLD_MS - 200) {
      setHighLatency(false);
      addReasoning("Network quality restored", "action");
    }
  }, [latencyMs, highLatency, addReasoning]);

  const markActivity = useCallback(() => { lastActivityRef.current = Date.now(); }, []);

  const softReset = useCallback(async () => {
    if (!callActive || isResetting) return;
    setIsResetting(true);
    addReasoning("Session timeout — performing soft reset...", "action");
    toast.info("Session idle — reinitializing connection...");
    if (retellInstance) {
      try { retellInstance.stopCall(); } catch { /* ignore */ }
      retellInstance = null;
    }
    setCallActive(false);
    setIsSpeaking(false);
    setVolumeLevel(0);
    await new Promise((r) => setTimeout(r, 500));
    setIsResetting(false);
    addReasoning("Soft reset complete — ready to reconnect", "action");
    addTranscript({ role: "system", text: "Session soft-reset complete. Press Start to reconnect.", timestamp: formatTime(callDuration) });
  }, [callActive, isResetting, addReasoning, addTranscript, callDuration, formatTime]);

  useEffect(() => {
    if (!callActive) {
      if (timeoutCheckRef.current) clearInterval(timeoutCheckRef.current);
      return;
    }
    lastActivityRef.current = Date.now();
    timeoutCheckRef.current = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current > TIMEOUT_THRESHOLD_MS) softReset();
    }, 2000);
    return () => { if (timeoutCheckRef.current) clearInterval(timeoutCheckRef.current); };
  }, [callActive, softReset]);

  const checkForModelSpecs = useCallback((text: string) => {
    const models = detectMfpModels(text);
    for (const spec of models) {
      if (!detectedModelsRef.current.has(spec.model)) {
        detectedModelsRef.current.add(spec.model);
        const lines = formatSpecSummary(spec);
        setSpecAlerts((prev) => [...prev, ...lines]);
        addReasoning(`📋 MFP detected: ${spec.model} (${spec.series} Series)`, "routing");
      }
    }
  }, [addReasoning]);

  const checkForTerminology = useCallback((text: string) => {
    const terms = detectTerminology(text);
    for (const t of terms) addReasoning(`📖 ${t.term}: ${t.definition.slice(0, 80)}...`, "routing");
  }, [addReasoning]);

  const triggerLiveQuery = useCallback(() => {
    setLiveQueryActive(true);
    if (liveQueryTimerRef.current) clearTimeout(liveQueryTimerRef.current);
    liveQueryTimerRef.current = window.setTimeout(() => setLiveQueryActive(false), 3000);
  }, []);

  const extractAndSaveLead = useCallback(async () => {
    // Sandbox is demonstration-only. No CRM persistence, no toasts.
    // Lead extraction is purely cosmetic for the reasoning log.
    const currentTranscript = transcriptRef.current;
    const fullText = currentTranscript.filter((t) => t.role !== "system").map((t) => t.text).join(" ");
    if (!fullText.trim()) return;
    const lead = extractLeadData(fullText);
    addReasoning(
      `Demo lead summary → ${lead.customerName} | Intent: ${lead.customerIntent} | Score: ${lead.leadScore}`,
      "action",
    );
  }, [addReasoning]);

  const startCall = useCallback(async () => {
    setCallConnecting(true);
    let connectWatchdog: ReturnType<typeof setTimeout> | null = null;
    try {
      // Mint a Retell WebRTC access token via the backend.
      const opts = optionsRef.current;
      const dynamicVars: Record<string, string> = {};
      const overrideVoice = opts.voiceId && opts.voiceId !== "default" ? opts.voiceId : null;
      const assistantName =
        overrideVoice && String(opts.voiceGender ?? "").toLowerCase() === "male" ? "Philip" : "Phoebe";
      if (opts.industry) dynamicVars.industry = opts.industry;
      if (opts.industryAddendum) dynamicVars.industry_addendum = opts.industryAddendum;
      if (opts.greeting) dynamicVars.greeting = opts.greeting.replace("Phoebe", assistantName);
      dynamicVars.assistant_name = assistantName;
      // STEP 6: rebuild the request body fresh from current selections every
      // call. Default voice → OMIT agent_override entirely and keep the
      // greeting/assistant_name as "Phoebe". Otherwise send a flat
      // `agent_override: { voice_id }` per Retell's REST API shape.
      const { data, error } = await supabase.functions.invoke("retell-access-token", {
        body: {
          agent_id: activeAgentId,
          retell_llm_dynamic_variables: Object.keys(dynamicVars).length ? dynamicVars : undefined,
          metadata: opts.industry ? { industry: opts.industry } : undefined,
          agent_override: overrideVoice ? { voice_id: overrideVoice } : undefined,
        },
      });

      if (error || !data?.access_token) {
        throw new Error(error?.message || "Could not mint voice access token");
      }

      const client = new RetellWebClient();
      retellInstance = client;

      setCallDuration(0);
      setTranscript([]);
      setReasoning([]);
      setStructuredOutputs([]);
      setLatencyMs(null);
      setHighLatency(false);
      setSpecAlerts([]);
      setLiveQueryActive(false);
      detectedModelsRef.current.clear();
      transcriptRef.current = [];
      lastTranscriptLengthRef.current = 0;

      addReasoning("Phaos AI Core Engine — handshake in flight", "action");
      addTranscript({ role: "system", text: "Connecting to Phaos AI Core Engine...", timestamp: "00:00" });

      connectWatchdog = setTimeout(() => {
        if (retellInstance) {
          try { retellInstance.stopCall(); } catch { /* ignore */ }
          retellInstance = null;
        }
        setCallConnecting(false);
        setCallActive(false);
        toast.error("Connection timed out. Check your network signal and try again.", { duration: 9000 });
      }, 20000);

      client.on("call_started", () => {
        if (connectWatchdog) { clearTimeout(connectWatchdog); connectWatchdog = null; }
        setCallActive(true);
        setCallConnecting(false);
        markActivity();
        addReasoning("Secure connection established — Phaos voice engine active", "action");
        addTranscript({ role: "system", text: "Call connected — Phaos AI active", timestamp: "00:00" });
      });

      client.on("call_ended", () => {
        setCallActive(false);
        setCallConnecting(false);
        setIsSpeaking(false);
        setVolumeLevel(0);
        addReasoning("Call terminated. Extracting lead data...", "action");
        addTranscript({ role: "system", text: "Call ended.", timestamp: formatTime(callDuration) });
        extractAndSaveLead();
        retellInstance = null;
      });

      client.on("agent_start_talking", () => {
        setIsSpeaking(true);
        markActivity();
        addReasoning("Agent speaking — streaming voice output", "action");
      });

      client.on("agent_stop_talking", () => {
        setIsSpeaking(false);
        markActivity();
      });

      // Retell's `update` event delivers the running transcript array. We
      // diff against the previous length to surface only the newest turns
      // so the audit trail stays append-only.
      type RetellTurn = { role: "agent" | "user"; content: string };
      client.on("update", (update: { transcript?: RetellTurn[] }) => {
        markActivity();
        const turns = update?.transcript ?? [];
        if (turns.length <= lastTranscriptLengthRef.current) return;
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        for (let i = lastTranscriptLengthRef.current; i < turns.length; i++) {
          const t = turns[i];
          if (!t?.content) continue;
          if (t.role === "agent") {
            addTranscript({ role: "ai", text: t.content, timestamp: now });
            checkForModelSpecs(t.content);
            const lower = t.content.toLowerCase();
            if (lower.includes("e-automate") || lower.includes("sales chain") || lower.includes("querying") || lower.includes("pulling")) {
              triggerLiveQuery();
            }
          } else if (t.role === "user") {
            addTranscript({ role: "caller", text: t.content, timestamp: now });
            addReasoning(`Caller: "${t.content.slice(0, 80)}${t.content.length > 80 ? "..." : ""}"`, "intent");
            checkForModelSpecs(t.content);
            checkForTerminology(t.content);
            setIsSpeaking(false);
          }
        }
        lastTranscriptLengthRef.current = turns.length;
      });

      client.on("metadata", (meta: unknown) => {
        addReasoning("LLM response generated — routing to voice engine", "routing");
        const m = meta as { latency?: number; tool_call?: { name?: string; arguments?: Record<string, unknown> } };
        if (typeof m?.latency === "number") setLatencyMs(m.latency);
        if (m?.tool_call?.name) {
          const name = m.tool_call.name;
          const args = m.tool_call.arguments ?? {};
          const now = new Date().toLocaleTimeString();
          addTranscript({ role: "system", text: `⚡ EXECUTING: ${name}`, timestamp: now, toolCall: { name, args } });
          addReasoning(`⚡ Tool triggered: ${name}`, "action");
          if (name.includes("dispatch") || name.includes("service")) {
            setStructuredOutputs((prev) => [...new Set([...prev, "APPOINTMENT_SET"])]);
          }
          if (name.includes("resolve") || name.includes("toner") || name.includes("fix")) {
            setStructuredOutputs((prev) => [...new Set([...prev, "ISSUE_RESOLVED"])]);
          }
        }
      });

      client.on("error", (err: unknown) => {
        if (connectWatchdog) { clearTimeout(connectWatchdog); connectWatchdog = null; }
        let detail = "Unknown";
        try {
          if (typeof err === "string") detail = err;
          else if (err && typeof err === "object" && "message" in err) detail = String((err as { message: unknown }).message);
          else if (err) detail = JSON.stringify(err).slice(0, 300);
        } catch { /* fall through */ }
        addReasoning(`Error: ${detail}`, "action");
        toast.error(`Call error: ${detail}`, { duration: 6000 });
        setCallActive(false);
        setCallConnecting(false);
        retellInstance = null;
      });

      await client.startCall({
        accessToken: data.access_token,
        sampleRate: data.sample_rate ?? 24000,
      });
    } catch (err: unknown) {
      if (connectWatchdog) { clearTimeout(connectWatchdog); connectWatchdog = null; }
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to connect: ${message}`);
      setCallConnecting(false);
      if (retellInstance) {
        try { retellInstance.stopCall(); } catch { /* ignore */ }
        retellInstance = null;
      }
    }
  }, [addReasoning, addTranscript, callDuration, extractAndSaveLead, markActivity, formatTime, checkForModelSpecs, checkForTerminology, triggerLiveQuery]);

  const endCall = useCallback(() => {
    if (retellInstance) {
      try { retellInstance.stopCall(); } catch { /* ignore */ }
      retellInstance = null;
    }
    setCallActive(false);
    setCallConnecting(false);
    setIsSpeaking(false);
    setVolumeLevel(0);
  }, []);

  return {
    callActive, callConnecting, isSpeaking, volumeLevel,
    transcript, reasoning, callDuration, latencyMs,
    structuredOutputs, highLatency, isResetting, specAlerts,
    liveQueryActive, startCall, endCall, formatTime,
  };
}
