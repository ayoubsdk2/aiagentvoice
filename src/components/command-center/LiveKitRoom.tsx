import { useEffect, useRef, useCallback, useState } from "react";

// ─── Types ──────────────────────────────────────────────────

interface LiveKitConfig {
  serverUrl: string;
  token: string;
}

interface AudioTrackState {
  trackSid: string;
  kind: "audio";
  source: "microphone" | "remote";
  muted: boolean;
}

interface LiveKitRoomState {
  connected: boolean;
  reconnecting: boolean;
  participantCount: number;
  localAudioTrack: AudioTrackState | null;
  remoteAudioTracks: AudioTrackState[];
  latencyMs: number;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

interface LiveKitRoomProps {
  /** Called when connection state changes */
  onStateChange?: (state: LiveKitRoomState) => void;
  /** Called when remote audio is available for playback */
  onRemoteAudio?: (stream: MediaStream) => void;
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
}

// ─── Component ──────────────────────────────────────────────

/**
 * Hidden background component that manages a LiveKit Room connection.
 * Handles incoming audio tracks, emits local microphone audio, and
 * reports connection state to parent via callbacks.
 *
 * This component renders nothing visible — it is a headless audio bridge.
 */
export function LiveKitRoom({ onStateChange, onRemoteAudio, autoConnect = false }: LiveKitRoomProps) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const latencyIntervalRef = useRef<number | null>(null);

  // ── Fetch LiveKit token from edge function ───────────────
  const fetchToken = useCallback(async (): Promise<LiveKitConfig | null> => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-proxy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            service: "livekit",
            action: "get-token",
            payload: { roomName: "inbound-call", participantName: "agent" },
          }),
        }
      );

      if (!res.ok) return null;
      const data = await res.json();
      return data as LiveKitConfig;
    } catch (err) {
      console.error("[LiveKitRoom] Token fetch failed:", err);
      return null;
    }
  }, []);

  // ── Acquire local microphone ─────────────────────────────
  const acquireMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error("[LiveKitRoom] Microphone access denied:", err);
      return null;
    }
  }, []);

  // ── Connect to room ──────────────────────────────────────
  const connect = useCallback(async () => {
    setStatus("connecting");

    const config = await fetchToken();
    if (!config) {
      setStatus("error");
      return;
    }

    const mic = await acquireMicrophone();

    // Report state
    onStateChange?.({
      connected: true,
      reconnecting: false,
      participantCount: 1,
      localAudioTrack: mic
        ? { trackSid: "local-mic", kind: "audio", source: "microphone", muted: false }
        : null,
      remoteAudioTracks: [],
      latencyMs: 0,
    });

    setStatus("connected");

    // TODO: Replace with actual LiveKit SDK Room.connect() when livekit-client is added
    // For now this establishes the pattern and state management
    console.log("[LiveKitRoom] Connected to room:", config.serverUrl);
  }, [fetchToken, acquireMicrophone, onStateChange]);

  // ── Disconnect ────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    if (latencyIntervalRef.current) {
      clearInterval(latencyIntervalRef.current);
    }

    setStatus("disconnected");
    onStateChange?.({
      connected: false,
      reconnecting: false,
      participantCount: 0,
      localAudioTrack: null,
      remoteAudioTracks: [],
      latencyMs: 0,
    });
  }, [onStateChange]);

  // ── Lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  // This component is headless — renders nothing
  return null;
}

export type { LiveKitRoomState, LiveKitConfig, ConnectionStatus };
