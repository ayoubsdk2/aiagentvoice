import { Phone, MapPin, Database, ShieldCheck, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { useDemoMode, SCOPE_META, type SampleScope } from "@/contexts/DemoModeContext";

interface AwaitingGoLiveProps {
  onNavigate: (tab: string) => void;
}

const ITEMS: Array<{ id: string; tab: string; icon: typeof Phone; title: string; description: string }> = [
  { id: "loc", tab: "Locations", icon: MapPin, title: "Add your locations", description: "List the offices, branches, or service hubs Phoebe will route calls between." },
  { id: "num", tab: "Numbers", icon: Phone, title: "Connect your phone numbers", description: "Map each business line to the AI gateway target Phaos provides." },
  { id: "int", tab: "Integrations", icon: Database, title: "Connect integrations", description: "Wire up your CRM, ERP, ticketing, and dispatch systems." },
  { id: "comp", tab: "Compliance", icon: ShieldCheck, title: "Review compliance settings", description: "Confirm PII scrubbing, consent capture, and retention policies for your industry." },
];

export function AwaitingGoLive({ onNavigate }: AwaitingGoLiveProps) {
  const { enable } = useDemoMode();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-xl px-5 py-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="text-primary" size={18} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold tracking-tight">Your portal is ready to go live</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Every dashboard, dropdown, and metric in this workspace will populate
              automatically once Phoebe starts handling your calls. Complete the
              steps below to activate your live deployment.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">
          Go-Live checklist
        </div>
        <div className="divide-y divide-border/40">
          {ITEMS.map((it, idx) => {
            const Icon = it.icon;
            return (
              <button
                key={it.id}
                onClick={() => onNavigate(it.tab)}
                className="w-full text-left flex items-center gap-4 py-4 group hover:bg-secondary/30 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="shrink-0 w-7 h-7 rounded-full border border-border/60 bg-secondary/40 flex items-center justify-center text-[11px] font-bold text-muted-foreground">
                  {idx + 1}
                </div>
                <Icon size={16} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold">{it.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{it.description}</div>
                </div>
                <ArrowRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-start gap-3 mb-4">
          <Sparkles className="text-primary mt-0.5" size={18} />
          <div className="flex-1">
            <div className="text-sm font-bold">Want to see what your live dashboard will look like?</div>
            <div className="text-xs text-muted-foreground mt-1">
              Preview a fully populated sample account at the scale that matches your business. Everything below is demo data — no real tenant info is exposed.
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(SCOPE_META) as SampleScope[]).map((scope) => {
            const meta = SCOPE_META[scope];
            return (
              <button
                key={scope}
                onClick={() => enable(scope)}
                className="text-left rounded-lg border border-border/40 bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-colors px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{meta.label} sample</span>
                  <ArrowRight size={13} className="text-muted-foreground" />
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{meta.subtitle}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
