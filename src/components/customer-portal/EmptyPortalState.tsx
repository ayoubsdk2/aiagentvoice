import { Database, Sparkles } from "lucide-react";
import { useDemoMode } from "@/contexts/DemoModeContext";

interface EmptyPortalStateProps {
  title: string;
  description: string;
}

/**
 * Standardized empty state for customer portal pages when there is no real tenant
 * data and demo mode is OFF. Invites the user to enable a sample account.
 */
export function EmptyPortalState({ title, description }: EmptyPortalStateProps) {
  const { enable } = useDemoMode();
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-xl px-6 py-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
        <Database className="text-primary" size={20} />
      </div>
      <h3 className="text-base font-bold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      <div className="mt-5 inline-flex items-center gap-2">
        <button
          onClick={() => enable("local")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/40 text-primary text-[11px] uppercase tracking-widest font-bold hover:bg-primary/25 transition-colors"
        >
          <Sparkles size={11} /> Preview a sample account
        </button>
      </div>
    </div>
  );
}
