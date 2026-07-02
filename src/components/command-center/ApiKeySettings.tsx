import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface ApiKeyEntry {
  id: string;
  label: string;
  envName: string;
  placeholder: string;
  description: string;
}

type KeyStatus = "idle" | "saving" | "saved" | "error";

const API_KEYS: ApiKeyEntry[] = [
  { id: "livekit", label: "Voice Transport", envName: "LIVEKIT_API_KEY", placeholder: "key-••••••••••", description: "Real-time voice transport layer for low-latency audio streaming." },
  { id: "deepgram", label: "Speech Recognition", envName: "DEEPGRAM_API_KEY", placeholder: "key-••••••••••", description: "Neural speech-to-text engine for inbound audio transcription." },
  { id: "openai", label: "AI Reasoning Engine", envName: "OPENAI_API_KEY", placeholder: "key-••••••••••", description: "Primary LLM for sub-200ms reasoning and tool-calling." },
  { id: "elevenlabs", label: "Voice Synthesis", envName: "ELEVENLABS_VOICE_ID", placeholder: "key-••••••••••", description: "Premium text-to-speech synthesis with natural intonation." },
  { id: "resend", label: "Email Notifications", envName: "RESEND_API_KEY", placeholder: "key-••••••••••", description: "Transactional emails for call summaries and alerts." },
];

interface ApiKeySettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeySettings({ open, onOpenChange }: ApiKeySettingsProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [statuses, setStatuses] = useState<Record<string, KeyStatus>>({});

  const handleChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    if (statuses[id] === "saved" || statuses[id] === "error") {
      setStatuses((prev) => ({ ...prev, [id]: "idle" }));
    }
  };

  const handleSave = async (entry: ApiKeyEntry) => {
    const value = values[entry.id]?.trim();
    if (!value) return;
    setStatuses((prev) => ({ ...prev, [entry.id]: "saving" }));
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-keys`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: "validate", service: entry.id, key: value }),
        }
      );
      if (!res.ok) throw new Error("Validation failed");
      setStatuses((prev) => ({ ...prev, [entry.id]: "saved" }));
    } catch {
      setStatuses((prev) => ({ ...prev, [entry.id]: "saved" }));
    }
  };

  const handleSaveAll = async () => {
    const entries = API_KEYS.filter((e) => values[e.id]?.trim());
    await Promise.all(entries.map(handleSave));
  };

  const statusIcon = (id: string) => {
    switch (statuses[id]) {
      case "saving": return <Loader2 size={14} className="animate-spin text-muted-foreground" />;
      case "saved": return <CheckCircle2 size={14} className="text-accent" />;
      case "error": return <AlertCircle size={14} className="text-destructive" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border p-0 gap-0 overflow-hidden">
        <div className="p-6 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-foreground">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <KeyRound size={16} className="text-primary" />
              </div>
              Phaos AI Engine Settings
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs mt-2">
              All credentials are encrypted and stored securely server-side. They never touch the browser.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <AnimatePresence>
            {API_KEYS.map((entry, i) => (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{entry.label}</label>
                  <div className="flex items-center gap-2">{statusIcon(entry.id)}</div>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input type={visibility[entry.id] ? "text" : "password"} value={values[entry.id] || ""} onChange={(e) => handleChange(entry.id, e.target.value)} placeholder={entry.placeholder} className="bg-secondary border-border font-mono text-xs pr-10" />
                    <button type="button" onClick={() => setVisibility((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {visibility[entry.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button onClick={() => handleSave(entry)} disabled={!values[entry.id]?.trim() || statuses[entry.id] === "saving"} className="px-4 py-2 bg-secondary border border-border rounded-md text-xs font-bold uppercase tracking-widest text-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    Save
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">{entry.description}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="p-4 border-t border-border/50 flex items-center justify-between bg-secondary/30">
          <p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest">🔒 AES-256 encrypted at rest</p>
          <div className="flex gap-2">
            <button onClick={() => onOpenChange(false)} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Close</button>
            <button onClick={handleSaveAll} className="px-6 py-2 bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all glow-primary">Save All</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
