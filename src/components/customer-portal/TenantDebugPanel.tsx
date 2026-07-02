import { useState } from "react";
import { Bug, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { useCustomerTenant } from "@/contexts/CustomerTenantContext";
import { useDemoMode } from "@/contexts/DemoModeContext";

const EMPTY = "None — awaiting setup";

/**
 * Floating debug panel. Shows which tenant fields are missing and explains how
 * each gates selector enablement and data hydration. Visible only when the
 * `?debug=tenant` query param is present, or in dev builds.
 */
export function TenantDebugPanel() {
  const [open, setOpen] = useState(false);
  const t = useCustomerTenant();
  const { state } = useDemoMode();

  const visible =
    import.meta.env.DEV ||
    (typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("debug") === "tenant");
  if (!visible) return null;

  const fields = [
    {
      id: "org",
      label: "Organization",
      value: t.organization,
      missing: t.organization === EMPTY,
      gates: "Org dropdown (disabled), all org-scoped queries",
    },
    {
      id: "loc",
      label: "Location",
      value: t.location,
      missing: t.location === EMPTY,
      gates: "Location dropdown (disabled), per-location KPIs",
    },
    {
      id: "num",
      label: "Phone number",
      value: t.phoneNumber,
      missing: t.phoneNumber === EMPTY,
      gates: "Number dropdown (disabled), call volume + transcripts",
    },
  ];

  return (
    <div
      data-testid="tenant-debug-panel"
      className="fixed bottom-4 right-4 z-[60] w-[320px] rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl text-xs"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 border-b border-border/40 hover:bg-secondary/40 rounded-t-xl"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 font-bold">
          <Bug size={12} className="text-primary" />
          Tenant debug
          <span
            className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full border ${
              state.enabled
                ? "border-primary/40 text-primary bg-primary/10"
                : "border-border/50 text-muted-foreground bg-muted/30"
            }`}
          >
            Demo {state.enabled ? `· ${state.scope}` : "off"}
          </span>
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="p-3 space-y-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            {fields.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-border/40 bg-secondary/20 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    {f.missing ? (
                      <XCircle size={11} className="text-amber-400" />
                    ) : (
                      <CheckCircle2 size={11} className="text-[hsl(var(--success))]" />
                    )}
                    {f.label}
                  </span>
                  <span
                    className={`text-[9px] uppercase tracking-widest font-bold ${
                      f.missing ? "text-amber-400" : "text-[hsl(var(--success))]"
                    }`}
                  >
                    {f.missing ? "Missing" : "Ready"}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground truncate">
                  {f.value}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Gates: {f.gates}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border/40 bg-secondary/10 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
              Hydration source
            </div>
            <div className="text-[10px] text-foreground/90">
              {state.enabled
                ? `Sample fixtures (${state.scope}) — selectors & dashboards populated from demo data.`
                : "Live tenant tables — selectors stay empty until real rows arrive."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
