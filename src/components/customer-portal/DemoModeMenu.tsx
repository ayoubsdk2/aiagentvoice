import { useState, useRef, useEffect } from "react";
import { Sparkles, ChevronDown, Check, X } from "lucide-react";
import { useDemoMode, SCOPE_META, type SampleScope } from "@/contexts/DemoModeContext";

export function DemoModeMenu() {
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

  const isOn = state.enabled;
  const activeScope = isOn ? state.scope : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] uppercase tracking-widest font-bold transition-colors ${
          isOn
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-transparent text-primary border-primary/40 hover:bg-primary/10"
        }`}
      >
        <Sparkles size={11} />
        {isOn ? `Sample · ${SCOPE_META[activeScope!].label}` : "View Sample Account"}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border/40">
            <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              Sample Live Account
            </div>
            <div className="text-[11px] text-muted-foreground/80 mt-0.5">
              Pick a scope to preview a fully populated dashboard.
            </div>
          </div>
          <div className="py-1">
            {(Object.keys(SCOPE_META) as SampleScope[]).map((scope) => {
              const meta = SCOPE_META[scope];
              const active = activeScope === scope;
              return (
                <button
                  key={scope}
                  onClick={() => {
                    enable(scope);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-secondary/60 transition-colors flex items-start gap-2.5 ${
                    active ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center">
                    {active && <Check size={12} className="text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold">{meta.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{meta.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {isOn && (
            <button
              onClick={() => {
                disable();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 border-t border-border/40 hover:bg-destructive/10 transition-colors flex items-center gap-2 text-xs font-bold text-destructive"
            >
              <X size={12} />
              Exit Sample Mode
            </button>
          )}
        </div>
      )}
    </div>
  );
}
