/**
 * TURN-TAKING ENGINE — Supabase Edge Function
 * Zero-Latency Voice Agent Orchestrator
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ──────────────────────────────────────────────────

type TurnState =
  | "idle"
  | "user_speaking"
  | "thinking_pause"
  | "terminal_pause"
  | "agent_processing"
  | "agent_speaking"
  | "barge_in";

interface PipelineConfig {
  thinkingPauseThresholdMs: number;
  terminalPauseThresholdMs: number;
  circularBufferMs: number;
  vadEnergyThreshold: number;
  minSpeechDurationMs: number;
}

interface PipelineMetrics {
  sttLatencyMs: number;
  llmLatencyMs: number;
  ttsLatencyMs: number;
  e2eLatencyMs: number;
  turnState: TurnState;
  bargeInCount: number;
  timestamp: number;
}

interface AudioFrame {
  pcmData: Uint8Array;
  timestampMs: number;
  rmsEnergy: number;
}

// ─── Constants ──────────────────────────────────────────────

const DEFAULT_CONFIG: PipelineConfig = {
  thinkingPauseThresholdMs: 300,
  terminalPauseThresholdMs: 700,
  circularBufferMs: 500,
  vadEnergyThreshold: 0.015,
  minSpeechDurationMs: 150,
};

// ─── Circular Buffer ────────────────────────────────────────

class CircularAudioBuffer {
  private buffer: AudioFrame[] = [];
  private maxDurationMs: number;

  constructor(maxDurationMs: number) {
    this.maxDurationMs = maxDurationMs;
  }

  push(frame: AudioFrame): void {
    this.buffer.push(frame);
    const cutoff = frame.timestampMs - this.maxDurationMs;
    while (this.buffer.length > 0 && this.buffer[0].timestampMs < cutoff) {
      this.buffer.shift();
    }
  }

  drain(): AudioFrame[] {
    const frames = [...this.buffer];
    this.buffer = [];
    return frames;
  }

  peek(): ReadonlyArray<AudioFrame> {
    return this.buffer;
  }

  get length(): number {
    return this.buffer.length;
  }

  get durationMs(): number {
    if (this.buffer.length < 2) return 0;
    return this.buffer[this.buffer.length - 1].timestampMs - this.buffer[0].timestampMs;
  }
}

// ─── Neural VAD ─────────────────────────────────────────────

class NeuralVAD {
  private config: PipelineConfig;
  private speechStartMs: number | null = null;
  private lastSpeechMs: number = 0;
  private noiseFloor: number = 0.005;
  private readonly noiseFloorAlpha = 0.02;

  constructor(config: PipelineConfig) {
    this.config = config;
  }

  process(frame: AudioFrame): TurnState {
    const isSpeech = frame.rmsEnergy > this.config.vadEnergyThreshold;

    if (!isSpeech) {
      this.noiseFloor = this.noiseFloorAlpha * frame.rmsEnergy + (1 - this.noiseFloorAlpha) * this.noiseFloor;
    }

    if (isSpeech) {
      if (this.speechStartMs === null) {
        this.speechStartMs = frame.timestampMs;
      }
      this.lastSpeechMs = frame.timestampMs;
      return "user_speaking";
    }

    if (this.speechStartMs !== null) {
      const silenceDurationMs = frame.timestampMs - this.lastSpeechMs;
      const speechDurationMs = this.lastSpeechMs - this.speechStartMs;

      if (speechDurationMs < this.config.minSpeechDurationMs) {
        if (silenceDurationMs > this.config.terminalPauseThresholdMs) {
          this.speechStartMs = null;
          return "idle";
        }
        return "thinking_pause";
      }

      if (silenceDurationMs < this.config.thinkingPauseThresholdMs) {
        return "thinking_pause";
      }

      if (silenceDurationMs >= this.config.terminalPauseThresholdMs) {
        this.speechStartMs = null;
        return "terminal_pause";
      }

      return "thinking_pause";
    }

    return "idle";
  }

  reset(): void {
    this.speechStartMs = null;
    this.lastSpeechMs = 0;
    this.noiseFloor = 0.005;
  }
}

// ─── Turn State Machine ────────────────────────────────────

class TurnStateMachine {
  private state: TurnState = "idle";
  private vad: NeuralVAD;
  private circularBuffer: CircularAudioBuffer;
  private config: PipelineConfig;
  private metrics: PipelineMetrics;
  private ttsQueue: Uint8Array[] = [];

  constructor(config: PipelineConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.vad = new NeuralVAD(config);
    this.circularBuffer = new CircularAudioBuffer(config.circularBufferMs);
    this.metrics = {
      sttLatencyMs: 0,
      llmLatencyMs: 0,
      ttsLatencyMs: 0,
      e2eLatencyMs: 0,
      turnState: "idle",
      bargeInCount: 0,
      timestamp: Date.now(),
    };
  }

  processFrame(frame: AudioFrame): {
    newState: TurnState;
    action: "none" | "start_stt" | "trigger_llm" | "flush_tts" | "emit_metrics";
    recoveredAudio?: AudioFrame[];
  } {
    this.circularBuffer.push(frame);
    const vadResult = this.vad.process(frame);
    const prevState = this.state;

    if (this.state === "agent_speaking" && vadResult === "user_speaking") {
      this.state = "barge_in";
      const recoveredAudio = this.circularBuffer.drain();
      this.ttsQueue = [];
      this.metrics.bargeInCount++;
      this.state = "user_speaking";
      return { newState: this.state, action: "flush_tts", recoveredAudio };
    }

    switch (vadResult) {
      case "user_speaking":
        this.state = "user_speaking";
        return { newState: this.state, action: prevState !== "user_speaking" ? "start_stt" : "none" };
      case "terminal_pause":
        if (prevState === "user_speaking" || prevState === "thinking_pause") {
          this.state = "agent_processing";
          return { newState: this.state, action: "trigger_llm" };
        }
        break;
      case "thinking_pause":
        this.state = "thinking_pause";
        return { newState: this.state, action: "none" };
      case "idle":
        this.state = "idle";
        break;
    }

    this.metrics.turnState = this.state;
    this.metrics.timestamp = Date.now();
    return { newState: this.state, action: "none" };
  }

  setAgentSpeaking(): void {
    this.state = "agent_speaking";
    this.metrics.turnState = this.state;
  }

  getMetrics(): PipelineMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.state = "idle";
    this.vad.reset();
    this.ttsQueue = [];
    this.metrics.bargeInCount = 0;
  }
}

// ─── Auth Helper ────────────────────────────────────────────

async function authenticateRequest(req: Request): Promise<{ userId: string; isAdmin: boolean } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  const userId = data.claims.sub as string;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "phaos_admin" });
  return { userId, isAdmin: !!isAdmin };
}

// ─── Edge Function Handler ──────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // WebSocket upgrade — no auth for now (handled by LiveKit token)
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() === "websocket") {
    return new Response(
      JSON.stringify({ error: "WebSocket not yet available in this environment" }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Require authentication for REST endpoints
  const auth = await authenticateRequest(req);
  if (!auth) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "status": {
        const engine = new TurnStateMachine();
        // Per-service key configuration topology only visible to platform admins.
        const services = auth.isAdmin ? {
          stt: Deno.env.get("DEEPGRAM_API_KEY") ? "configured" : "missing",
          llm: Deno.env.get("OPENAI_API_KEY") ? "configured" : "missing",
          tts: Deno.env.get("ELEVENLABS_VOICE_ID") ? "configured" : "missing",
          livekit: Deno.env.get("LIVEKIT_API_KEY") ? "configured" : "missing",
          email: Deno.env.get("RESEND_API_KEY") ? "configured" : "missing",
        } : undefined;
        return new Response(
          JSON.stringify({
            status: "ready",
            config: DEFAULT_CONFIG,
            metrics: engine.getMetrics(),
            ...(services ? { services } : {}),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "configure": {
        const { config } = body;
        return new Response(
          JSON.stringify({ success: true, config: { ...DEFAULT_CONFIG, ...config } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
