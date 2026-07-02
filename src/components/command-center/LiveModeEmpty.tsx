import { Database } from "lucide-react";
import { useAccountMode } from "@/contexts/AccountModeContext";

interface LiveModeEmptyProps {
  /** Title shown to the user, e.g. "No leads yet". */
  title: string;
  /** One-line explanation of why this view is empty in live mode. */
  description?: string;
}

/**
 * Standardized empty-state for live mode when a tenant has no real data yet.
 * Use it inside any dashboard panel after the user enters live mode.
 */
export function LiveModeEmpty({
  title,
  description = "This view is scoped to your live customer account. Real data will appear here as soon as call activity is recorded.",
}: LiveModeEmptyProps) {
  const { liveAccount } = useAccountMode();
  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-card flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
        <Database className="text-primary" size={20} />
      </div>
      <h3 className="text-base font-bold text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      {liveAccount && (
        <p className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground/80">
          Live customer · {liveAccount.displayName}
        </p>
      )}
    </div>
  );
}
