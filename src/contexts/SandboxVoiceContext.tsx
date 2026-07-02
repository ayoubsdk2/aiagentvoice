import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VoiceOption {
  id: string;
  name: string;
  provider?: string;
  accent?: string;
  gender?: string;
  age?: string;
  previewUrl?: string;
}

export const DEFAULT_VOICE: VoiceOption = {
  id: "default",
  name: "Default Voice",
};

export const DEFAULT_VOICE_ID = DEFAULT_VOICE.id;

// ─── Module-level store (shared across all consumers) ────────
interface StoreState {
  voices: VoiceOption[];
  voiceId: string;
  loading: boolean;
  loaded: boolean;
}

let state: StoreState = {
  voices: [DEFAULT_VOICE],
  voiceId: DEFAULT_VOICE_ID,
  loading: false,
  loaded: false,
};

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function getSnapshot() { return state; }

export function setVoiceId(id: string) {
  if (state.voiceId === id) return;
  state = { ...state, voiceId: id };
  emit();
}

interface RawRetellVoice {
  voice_id: string;
  voice_name: string;
  provider?: string;
  accent?: string;
  gender?: string;
  age?: string;
  preview_audio_url?: string;
}

async function loadVoicesOnce() {
  if (state.loaded || state.loading) return;
  state = { ...state, loading: true };
  emit();
  try {
    const { data, error } = await supabase.functions.invoke("list-retell-voices", { method: "GET" });
    if (error) throw error;
    const raw: RawRetellVoice[] = (data?.voices ?? []) as RawRetellVoice[];
    const mapped: VoiceOption[] = raw
      .filter((v) => v?.voice_id && v?.voice_name)
      .map((v) => ({
        id: v.voice_id,
        name: v.voice_name,
        provider: v.provider,
        accent: v.accent,
        gender: v.gender,
        age: v.age,
        previewUrl: v.preview_audio_url,
      }));
    state = {
      voices: [DEFAULT_VOICE, ...mapped],
      voiceId: state.voiceId,
      loading: false,
      loaded: true,
    };
  } catch {
    state = { ...state, loading: false, loaded: true };
  }
  emit();
}

// ─── React API ────────────────────────────────────────────────
interface SandboxVoiceContextValue {
  voices: VoiceOption[];
  voice: VoiceOption;
  voiceId: string;
  loading: boolean;
  setVoiceId: (id: string) => void;
}

const SandboxVoiceContext = createContext<SandboxVoiceContextValue | null>(null);

export function SandboxVoiceProvider({ children }: { children: ReactNode }) {
  // Kick off the load (idempotent).
  useEffect(() => { void loadVoicesOnce(); }, []);
  return <SandboxVoiceContext.Provider value={useSandboxVoiceInternal()}>{children}</SandboxVoiceContext.Provider>;
}

function useSandboxVoiceInternal(): SandboxVoiceContextValue {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const voice = snap.voices.find((v) => v.id === snap.voiceId) ?? DEFAULT_VOICE;
  return { voices: snap.voices, voice, voiceId: snap.voiceId, loading: snap.loading, setVoiceId };
}

/**
 * Works with OR without a SandboxVoiceProvider — reads from a shared module
 * store so VapiSandbox and the voice picker stay in sync no matter where each
 * is rendered.
 */
export function useSandboxVoice(): SandboxVoiceContextValue {
  // Always trigger a load on first use.
  useEffect(() => { void loadVoicesOnce(); }, []);
  const ctx = useContext(SandboxVoiceContext);
  const fallback = useSandboxVoiceInternal();
  return ctx ?? fallback;
}
