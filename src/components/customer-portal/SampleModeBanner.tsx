import { Sparkles, X } from "lucide-react";
import { useDemoMode, SCOPE_META } from "@/contexts/DemoModeContext";

export function SampleModeBanner() {
  const { state, disable } = useDemoMode();
  if (!state.enabled) return null;
  const meta = SCOPE_META[state.scope];

  return (
    <div className="flex items-center gap-3 px-4 md:px-6 py-2 border-b border-primary/30 bg-gradient-to-r from-primary/15 to-primary/5">
      <Sparkles size={13} className="text-primary shrink-0" />
      <div className="flex-1 text-[11px] text-foreground/90">
        <span className="font-bold text-foreground">Sample mode — {meta.label}.</span>{" "}
        <span className="text-muted-foreground">
          Every metric, location, lead, and number on screen is demo data ({meta.subtitle}).
        </span>
      </div>
      <button
        onClick={disable}
        className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-primary hover:text-foreground transition-colors"
      >
        <X size={11} /> Exit
      </button>
    </div>
  );
}
