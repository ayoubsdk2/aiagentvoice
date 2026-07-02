import { Sparkles, CircleSlash, X, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useDemoMode, SCOPE_META, type SampleScope } from "@/contexts/DemoModeContext";

/**
 * Always-visible banner showing the current DemoMode state.
 * - OFF: subtle muted strip explaining the portal is awaiting live data.
 * - ON: highlighted strip showing the active scope, with quick scope switcher
 *   and an Exit button.
 *
 * Replaces SampleModeBanner (which only rendered when demo was enabled).
 */
export function DemoModeBanner() {
  const { state, enable, disable } = useDemoMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!state.enabled) {
    return (
      <div
        data-testid="demo-mode-banner"
        data-demo-state="off"
        className="flex items-center gap-2 px-4 md:px-6 py-1.5 border-b border-border/40 bg-muted/20 text-[11px] text-muted-foreground"
      >
        <CircleSlash size={11} className="shrink-0" />
        <span>
          <span className="font-semibold text-foreground">Sample Live Account: Off.</span>{" "}
          Analytics and calls stay empty until your live data flows in. Use{" "}
          <span className="font-semibold text-foreground">View Sample Account</span>{" "}
          in the header to preview a populated dashboard.
        </span>
      </div>
    );
  }

  const meta = SCOPE_META[state.scope];

  return (
    <div
      data-testid="demo-mode-banner"
      data-demo-state="on"
      data-demo-scope={state.scope}
      className="flex items-center gap-3 px-4 md:px-6 py-2 border-b border-primary/30 bg-gradient-to-r from-primary/15 to-primary/5"
    >
      <Sparkles size={13} className="text-primary shrink-0" />
      <div className="flex-1 text-[11px] text-foreground/90">
        <span className="font-bold text-foreground">
          Sample Live Account: On — {meta.label}.
        </span>{" "}
        <span className="text-muted-foreground">
          Every metric, location, lead, and number is demo data ({meta.subtitle}).
        </span>
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Switch sample scope"
          className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-primary/40 bg-primary/10 text-[10px] uppercase tracking-widest font-bold text-primary hover:bg-primary/20 transition-colors"
        >
          {meta.label}
          <ChevronDown size={10} />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
          >
            {(Object.keys(SCOPE_META) as SampleScope[]).map((scope) => {
              const m = SCOPE_META[scope];
              const active = state.scope === scope;
              return (
                <button
                  key={scope}
                  onClick={() => {
                    enable(scope);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[11px] hover:bg-secondary/60 transition-colors ${
                    active ? "bg-primary/10 text-foreground font-bold" : "text-muted-foreground"
                  }`}
                >
                  <div className="font-bold">{m.label}</div>
                  <div className="text-[10px] text-muted-foreground/80 mt-0.5">{m.subtitle}</div>
                </button>
              );
            })}
          </div>
        )}
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
