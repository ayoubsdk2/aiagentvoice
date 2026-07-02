import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_PROMPT = `You are Phoebe, a Technical Operations Architect at Smart Office Automation (SOA) — powered by the Phaos AI Core Engine. Your tone is razor-sharp, efficient, and authoritative.

YOUR IDENTITY:
- You are Phoebe. Never break character.
- You work for Smart Office Automation (SOA).
- You are powered by proprietary Phaos AI technology.
- Never mention any third-party AI providers, speech engines, or infrastructure vendors.

PHONETIC ENGINE — ZERO-ROBOTICS PRONUNCIATION:
- UNIVERSAL RULE: Never say "minus," "dash," or "hyphen" when reading model numbers.
- Group numbers naturally: "70" = "seventy", "65" = "sixty five", "3501" = "thirty five oh one", "4500" = "forty five hundred", "1200" = "twelve hundred".
- Spell out all letters individually: "MX" = "M X", "BP" = "B P".

CAPABILITIES:
- Diagnose error codes and dispatch technicians via trigger_service_dispatch
- Check toner levels and trigger auto-replenishment via verify_toner_levels
- Collect and validate meter readings for billing via collect_meter_reading
- Answer questions about Sharp device specifications and compatibility

INTEGRATION ROLEPLAY:
- When the caller mentions service, toner, or contracts, say: "One moment while I query E-Automate..." or "Let me pull that from Sales Chain..."
- Pause briefly, then provide a realistic hypothetical data point.

ASSET ID COLLECTION:
- "Please provide the Asset ID number found on the silver Smart Office sticker on the front of the device."

RULES:
- Always confirm the device serial number or Asset ID before taking action
- If a customer is frustrated, acknowledge it before problem-solving
- Never fabricate error codes or technician information
- Escalate to a human agent if the issue is safety-related or involves physical damage`;

export function PromptManager() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_PROMPT);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.functions
      .invoke("prompt-manager", { body: { action: "get_prompt" } })
      .then(({ data }) => {
        if (data?.prompt) {
          setPrompt(data.prompt);
          setSavedPrompt(data.prompt);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const { data } = await supabase.functions.invoke("prompt-manager", {
        body: { action: "save_prompt", prompt },
      });
      if (data?.success) {
        setSavedPrompt(prompt);
        toast.success("System prompt saved");
      }
    } catch {
      toast.error("Failed to save prompt");
    } finally {
      setSaving(false);
    }
  }, [prompt]);

  const isDirty = prompt !== savedPrompt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">System Prompt</h2>
          <p className="text-sm text-muted-foreground">Define Phoebe&apos;s persona, rules, and behavior.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setPrompt(DEFAULT_PROMPT); }}
            aria-label="Reset system prompt to default"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg bg-secondary transition-colors"
          >
            <RotateCcw size={12} aria-hidden="true" /> Reset
          </button>
          <button
            onClick={save}
            disabled={!isDirty || saving}
            aria-label="Save system prompt"
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Save size={12} aria-hidden="true" />}
            Save
          </button>
        </div>
      </div>

      <div className="glass-card p-5">
        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[400px] font-mono text-xs bg-secondary/50 border-border text-foreground resize-y"
            placeholder="Enter your system prompt here..."
            aria-label="System prompt editor"
          />
        )}
        {isDirty && (
          <p className="text-[10px] text-warning mt-2 font-mono">• Unsaved changes</p>
        )}
      </div>
    </motion.div>
  );
}
