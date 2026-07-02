import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Check, ChevronsUpDown, Play, Square } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSandboxVoice, DEFAULT_VOICE, DEFAULT_VOICE_ID, type VoiceOption } from "@/contexts/SandboxVoiceContext";

// ─── Shared single-stream preview audio ──────────────────────
let currentAudio: HTMLAudioElement | null = null;
let currentPreviewId: string | null = null;
const previewListeners = new Set<(id: string | null) => void>();
function setPlayingId(id: string | null) {
  currentPreviewId = id;
  previewListeners.forEach((l) => l(id));
}
function stopPreview() {
  if (currentAudio) {
    try { currentAudio.pause(); } catch { /* ignore */ }
    currentAudio = null;
  }
  setPlayingId(null);
}
function playPreview(voice: VoiceOption) {
  if (!voice.previewUrl) return;
  if (currentPreviewId === voice.id) { stopPreview(); return; }
  stopPreview();
  const audio = new Audio(voice.previewUrl);
  audio.onended = () => { if (currentPreviewId === voice.id) stopPreview(); };
  audio.onerror = () => stopPreview();
  currentAudio = audio;
  setPlayingId(voice.id);
  audio.play().catch(() => stopPreview());
}
function usePlayingId(): string | null {
  const [id, setId] = useState<string | null>(currentPreviewId);
  useEffect(() => {
    const l = (next: string | null) => setId(next);
    previewListeners.add(l);
    return () => { previewListeners.delete(l); };
  }, []);
  return id;
}

function titleCase(s?: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function genderBadgeClasses(g: string): string {
  const norm = g.toLowerCase();
  if (norm === "male") return "border-sky-400/60 text-sky-300 bg-sky-400/10";
  if (norm === "female") return "border-pink-400/60 text-pink-300 bg-pink-400/10";
  return "border-[#f5c542]/40 text-[#f5c542]/90";
}

export function VoiceCombobox() {
  const { voices, voiceId, voice, setVoiceId, loading } = useSandboxVoice();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<string>("all");
  const [accent, setAccent] = useState<string>("all");
  const playingId = usePlayingId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!open) stopPreview(); }, [open]);

  // Every voice from the API (excluding the pinned default).
  const realVoices = useMemo(
    () => voices.filter((v) => v.id !== DEFAULT_VOICE_ID),
    [voices],
  );

  const selectedName = useMemo(() => {
    if (voiceId === DEFAULT_VOICE_ID) return DEFAULT_VOICE.name;
    return realVoices.find((v) => v.id === voiceId)?.name ?? voice.name;
  }, [realVoices, voice.name, voiceId]);

  const genderOptions = useMemo(() => {
    const set = new Set<string>();
    realVoices.forEach((v) => { if (v.gender) set.add(v.gender); });
    return Array.from(set).sort();
  }, [realVoices]);

  const accentOptions = useMemo(() => {
    const set = new Set<string>();
    realVoices.forEach((v) => { if (v.accent) set.add(v.accent); });
    return Array.from(set).sort();
  }, [realVoices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return realVoices.filter((v) => {
      if (gender !== "all" && v.gender !== gender) return false;
      if (accent !== "all" && v.accent !== accent) return false;
      if (q) {
        const hay = `${v.name} ${v.accent ?? ""} ${v.provider ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [realVoices, query, gender, accent]);

  // Group by provider, alphabetized inside each group.
  const grouped = useMemo(() => {
    const map = new Map<string, VoiceOption[]>();
    for (const v of filtered) {
      const key = v.provider ?? "Other";
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    const cmp = (a: VoiceOption, b: VoiceOption) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
    return Array.from(map.entries())
      .map(([provider, arr]) => ({ provider, voices: arr.slice().sort(cmp) }))
      .sort((a, b) => a.provider.localeCompare(b.provider, undefined, { sensitivity: "base" }));
  }, [filtered]);

  const handleSelect = (id: string) => {
    setVoiceId(id);
    stopPreview();
    setOpen(false);
  };

  const renderRow = (v: VoiceOption) => {
    const isPlaying = playingId === v.id;
    const isSelected = voiceId === v.id;
    return (
      <div
        key={v.id}
        role="button"
        tabIndex={0}
        onClick={() => handleSelect(v.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(v.id); } }}
        className={cn(
          "group w-full flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[#f5c542]/10 transition-colors",
          isSelected ? "text-[#fff3a3] font-semibold" : "text-[#f5c542]",
        )}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); playPreview(v); }}
          disabled={!v.previewUrl}
          aria-label={isPlaying ? `Stop preview of ${v.name}` : `Test ${v.name}`}
          title={v.previewUrl ? (isPlaying ? "Stop preview" : "Test voice") : "No preview available"}
          className={cn(
            "shrink-0 inline-flex items-center gap-1 h-7 pl-1.5 pr-2 rounded-full border border-[#f5c542]/50 text-[#f5c542] hover:bg-[#f5c542]/20 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold tracking-wide",
            isPlaying && "bg-[#f5c542]/30 text-[#fff3a3]",
          )}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current">
            {isPlaying ? <Square size={8} fill="currentColor" /> : <Play size={8} fill="currentColor" />}
          </span>
          <span>TEST</span>
        </button>
        <Check size={14} className={cn("shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
        <span className="truncate flex-1 mr-1">{v.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          {v.gender && (
            <span className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
              genderBadgeClasses(v.gender),
            )}>
              {titleCase(v.gender)}
            </span>
          )}
          {v.accent && (
            <span className="inline-flex items-center rounded-full border border-[#f5c542]/40 text-[#f5c542]/90 px-2 py-0.5 text-xs font-medium">
              {v.accent}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label="Search and select voice"
          aria-expanded={open}
          className="flex items-center gap-2 h-9 w-[160px] xs:w-[200px] sm:w-[240px] md:w-[260px] max-w-[55vw] px-3 rounded-full bg-secondary/50 border border-[#f5c542]/40 text-xs sm:text-sm font-bold text-[#f5c542] hover:bg-secondary/70 focus:outline-none focus:ring-1 focus:ring-[#f5c542]/40 transition-colors"
        >
          <Mic size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate flex-1 text-left">{selectedName}</span>
          <ChevronsUpDown size={14} className="shrink-0 opacity-70" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 w-[min(680px,95vw)] bg-background border-[#f5c542]/30"
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
      >
        <div className="flex flex-col">
          <div className="p-2 border-b border-[#f5c542]/20 space-y-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, accent, or provider…"
              aria-label="Search voices"
              className="w-full h-9 px-3 rounded-md bg-secondary/40 border border-[#f5c542]/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#f5c542]/40"
            />
            <div className="flex gap-2">
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="h-8 text-xs border-[#f5c542]/30 text-[#f5c542]">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All genders</SelectItem>
                  {genderOptions.map((g) => (
                    <SelectItem key={g} value={g}>{titleCase(g)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={accent} onValueChange={setAccent}>
                <SelectTrigger className="h-8 text-xs border-[#f5c542]/30 text-[#f5c542]">
                  <SelectValue placeholder="Accent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accents</SelectItem>
                  {accentOptions.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="max-h-[55vh] overflow-y-auto overflow-x-hidden py-1">
            {/* Pinned Default */}
            <button
              type="button"
              onClick={() => handleSelect(DEFAULT_VOICE_ID)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#f5c542]/10 transition-colors",
                voiceId === DEFAULT_VOICE_ID ? "text-[#fff3a3] font-semibold" : "text-[#f5c542]",
              )}
            >
              <Check size={14} className={cn("shrink-0", voiceId === DEFAULT_VOICE_ID ? "opacity-100" : "opacity-0")} />
              <span className="flex-1 truncate">Default Voice</span>
              <span className="text-[10px] text-muted-foreground">agent default</span>
            </button>

            {loading && (
              <div className="px-3 py-4 text-xs text-muted-foreground">Loading voices…</div>
            )}
            {!loading && grouped.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground">No voices match.</div>
            )}

            {grouped.map((g) => (
              <div key={g.provider}>
                <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-[#f5c542]/70 font-semibold border-t border-[#f5c542]/10 mt-2">
                  {g.provider}
                </div>
                {g.voices.map(renderRow)}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
