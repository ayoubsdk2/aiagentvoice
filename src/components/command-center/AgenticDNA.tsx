import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Save, Info } from "lucide-react";
import { toast } from "sonner";

const VOICE_STORAGE_KEY = "phaos-voice-settings";
const BEHAVIOR_STORAGE_KEY = "phaos-behavior-settings";

interface VoiceSettings {
  engine: string;
  voice: string;
  locale: string;
  speed: number;
  pitch: number;
  temperature: number;
  stability: number;
  similarityBoost: number;
  styleExaggeration: number;
  speakerBoost: boolean;
  emotionIntensity: number;
  breathingNaturalism: number;
  pauseDuration: number;
  responseDelay: number;
}

interface BehaviorSettings {
  empathy: number;
  bargeIn: number;
  silenceTimeout: number;
  escalationThreshold: number;
  confirmationFrequency: string;
  verbosityLevel: number;
  proactiveSuggestions: boolean;
  sentimentSensitivity: number;
}

const DEFAULT_VOICE: VoiceSettings = {
  engine: "premium", voice: "brian", locale: "us",
  speed: 1.0, pitch: 0.5, temperature: 0.7,
  stability: 0.5, similarityBoost: 0.75, styleExaggeration: 0.3,
  speakerBoost: true, emotionIntensity: 0.4, breathingNaturalism: 0.3,
  pauseDuration: 200, responseDelay: 100,
};

const DEFAULT_BEHAVIOR: BehaviorSettings = {
  empathy: 0.6, bargeIn: 250, silenceTimeout: 3,
  escalationThreshold: 0.7, confirmationFrequency: "medium",
  verbosityLevel: 0.5, proactiveSuggestions: true, sentimentSensitivity: 0.6,
};

function loadSettings<T>(key: string, defaults: T): T {
  try { const s = localStorage.getItem(key); return s ? { ...defaults, ...JSON.parse(s) } : defaults; }
  catch { return defaults; }
}

export function AgenticDNA() {
  const [activeTab, setActiveTab] = useState<"voice" | "behavior" | "knowledge">("voice");
  const [voice, setVoice] = useState<VoiceSettings>(() => loadSettings(VOICE_STORAGE_KEY, DEFAULT_VOICE));
  const [behavior, setBehavior] = useState<BehaviorSettings>(() => loadSettings(BEHAVIOR_STORAGE_KEY, DEFAULT_BEHAVIOR));

  const updateVoice = useCallback(<K extends keyof VoiceSettings>(key: K, val: VoiceSettings[K]) => {
    setVoice((prev) => ({ ...prev, [key]: val }));
  }, []);

  const updateBehavior = useCallback(<K extends keyof BehaviorSettings>(key: K, val: BehaviorSettings[K]) => {
    setBehavior((prev) => ({ ...prev, [key]: val }));
  }, []);

  const saveAll = () => {
    localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(voice));
    localStorage.setItem(BEHAVIOR_STORAGE_KEY, JSON.stringify(behavior));
    toast.success("Configuration saved successfully");
  };

  const tabs = [
    { id: "voice" as const, label: "Voice Engine" },
    { id: "behavior" as const, label: "Behavioral Dynamics" },
    { id: "knowledge" as const, label: "Knowledge Base" },
  ];

  const SliderRow = ({ label, value, onChange, min, max, step, unit = "" }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit?: string }) => (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</label>
        <span className="text-xs font-mono text-foreground">{value}{unit}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-1 p-1 glass-card w-fit">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <Button variant="default" onClick={saveAll} className="gap-2">
          <Save size={16} /> Save Configuration
        </Button>
      </div>

      <div className="flex items-center gap-2 p-3 glass-card text-[10px] text-muted-foreground">
        <Info size={14} className="text-primary shrink-0" />
        These settings apply globally to both the Sandbox demo and any deployed live agent.
      </div>

      {activeTab === "voice" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 space-y-5">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Voice Selection</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 block">Voice Engine</label>
                <Select value={voice.engine} onValueChange={(v) => updateVoice("engine", v)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">Premium Neural Voice</SelectItem>
                    <SelectItem value="standard">Standard Voice</SelectItem>
                    <SelectItem value="ultra">Ultra HD Voice</SelectItem>
                    <SelectItem value="realtime">Real-time Optimized</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 block">Voice Selection</label>
                <Select value={voice.voice} onValueChange={(v) => updateVoice("voice", v)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Brian (Professional)", "Sarah (Friendly)", "Marcus (Authoritative)", "Roger (Confident)", "Laura (Warm)", "Charlie (Casual)", "George (Distinguished)", "Callum (Energetic)", "River (Calm)", "Liam (Narrator)", "Alice (Helpful)", "Matilda (Elegant)", "Jessica (Expressive)", "Eric (Conversational)", "Chris (Clear)", "Daniel (Deep)", "Lily (Soft)", "Will (Natural)"].map((v) => {
                      const id = v.split(" ")[0].toLowerCase();
                      return <SelectItem key={id} value={id}>{v}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 block">Accent / Locale</label>
                <Select value={voice.locale} onValueChange={(v) => updateVoice("locale", v)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[["us","US English"],["uk","UK English"],["aus","Australian English"],["ca","Canadian English"],["in","Indian English"],["es","Spanish"],["fr","French"],["de","German"],["it","Italian"],["pt","Portuguese"],["jp","Japanese"],["ko","Korean"],["zh","Mandarin Chinese"],["ar","Arabic"],["hi","Hindi"]].map(([v,l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 space-y-5">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Voice Tuning</h3>
            <div className="space-y-5">
              <SliderRow label="Speaking Speed" value={voice.speed} onChange={(v) => updateVoice("speed", v)} min={0.5} max={2.0} step={0.1} unit="x" />
              <SliderRow label="Pitch" value={voice.pitch} onChange={(v) => updateVoice("pitch", v)} min={0} max={1} step={0.05} />
              <SliderRow label="Temperature / Creativity" value={voice.temperature} onChange={(v) => updateVoice("temperature", v)} min={0} max={1} step={0.05} />
              <SliderRow label="Stability" value={voice.stability} onChange={(v) => updateVoice("stability", v)} min={0} max={1} step={0.05} />
              <SliderRow label="Similarity Boost" value={voice.similarityBoost} onChange={(v) => updateVoice("similarityBoost", v)} min={0} max={1} step={0.05} />
              <SliderRow label="Style Exaggeration" value={voice.styleExaggeration} onChange={(v) => updateVoice("styleExaggeration", v)} min={0} max={1} step={0.05} />
            </div>
          </div>

          <div className="glass-card p-6 space-y-5">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Advanced Voice Parameters</h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">Speaker Boost</p>
                  <p className="text-[10px] text-muted-foreground">Enhance clarity and similarity</p>
                </div>
                <Switch checked={voice.speakerBoost} onCheckedChange={(v) => updateVoice("speakerBoost", v)} />
              </div>
              <SliderRow label="Emotion Intensity" value={voice.emotionIntensity} onChange={(v) => updateVoice("emotionIntensity", v)} min={0} max={1} step={0.05} />
              <SliderRow label="Breathing Naturalism" value={voice.breathingNaturalism} onChange={(v) => updateVoice("breathingNaturalism", v)} min={0} max={1} step={0.05} />
              <SliderRow label="Pause Duration" value={voice.pauseDuration} onChange={(v) => updateVoice("pauseDuration", v)} min={50} max={500} step={10} unit="ms" />
              <SliderRow label="Response Delay" value={voice.responseDelay} onChange={(v) => updateVoice("responseDelay", v)} min={0} max={500} step={10} unit="ms" />
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "behavior" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Core Behavioral Parameters</h3>
            <div className="space-y-6">
              <div>
                <SliderRow label="Empathy vs. Efficiency" value={behavior.empathy} onChange={(v) => updateBehavior("empathy", v)} min={0} max={1} step={0.05} />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-muted-foreground">Maximum Empathy</span>
                  <span className="text-[9px] text-muted-foreground">Maximum Efficiency</span>
                </div>
              </div>
              <SliderRow label="Barge-in Sensitivity" value={behavior.bargeIn} onChange={(v) => updateBehavior("bargeIn", v)} min={100} max={500} step={10} unit="ms" />
              <SliderRow label="Silence Timeout" value={behavior.silenceTimeout} onChange={(v) => updateBehavior("silenceTimeout", v)} min={1} max={10} step={0.5} unit="s" />
              <SliderRow label="Verbosity Level" value={behavior.verbosityLevel} onChange={(v) => updateBehavior("verbosityLevel", v)} min={0} max={1} step={0.05} />
            </div>
          </div>

          <div className="glass-card p-6 space-y-6">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Advanced Behavioral Dynamics</h3>
            <div className="space-y-6">
              <SliderRow label="Escalation Threshold" value={behavior.escalationThreshold} onChange={(v) => updateBehavior("escalationThreshold", v)} min={0} max={1} step={0.05} />
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 block">Confirmation Frequency</label>
                <Select value={behavior.confirmationFrequency} onValueChange={(v) => updateBehavior("confirmationFrequency", v)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low — Minimal confirmations</SelectItem>
                    <SelectItem value="medium">Medium — Balanced</SelectItem>
                    <SelectItem value="high">High — Confirm everything</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground font-medium">Proactive Suggestions</p>
                  <p className="text-[10px] text-muted-foreground">Offer relevant tips unprompted</p>
                </div>
                <Switch checked={behavior.proactiveSuggestions} onCheckedChange={(v) => updateBehavior("proactiveSuggestions", v)} />
              </div>
              <SliderRow label="Sentiment Sensitivity" value={behavior.sentimentSensitivity} onChange={(v) => updateBehavior("sentimentSensitivity", v)} min={0} max={1} step={0.05} />
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "knowledge" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 space-y-6">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Knowledge Base (RAG)</h3>
          <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center hover:border-primary/50 transition-colors cursor-pointer">
            <Upload size={40} className="text-muted-foreground mb-4" />
            <p className="text-foreground font-medium">Drag & Drop Sharp Service Manuals</p>
            <p className="text-muted-foreground text-sm mt-1">PDF, DOCX up to 50MB each</p>
          </div>
          <div className="space-y-2">
            {[
              { name: "MX-M365N_Service_Manual_v3.2.pdf", size: "24.3 MB", pages: 342 },
              { name: "BP-70C45_Error_Codes_Reference.pdf", size: "8.1 MB", pages: 89 },
              { name: "Sharp_Toner_Compatibility_Matrix.pdf", size: "2.4 MB", pages: 15 },
            ].map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div>
                  <p className="text-sm text-foreground font-medium">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">{f.size} • Indexed {f.pages} pages</p>
                </div>
                <span className="text-[10px] text-accent font-bold uppercase">Active</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function Button({ variant = "default", size = "default", onClick, className = "", children, ...props }: { variant?: string; size?: string; onClick?: () => void; className?: string; children: React.ReactNode; [key: string]: any }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all ${
        variant === "default" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-secondary/50 text-foreground hover:bg-secondary"
      } ${size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
