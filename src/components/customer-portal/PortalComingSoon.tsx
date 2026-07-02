import { Sparkles, type LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
}

/**
 * Reusable placeholder for customer portal pages that are still being wired
 * to live tenant data. Renders a premium dark-themed empty state — never
 * mixes sample data with real tenant data.
 */
export function PortalComingSoon({ icon: Icon, title, description, features }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/15 to-primary/5 px-4 py-3 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-foreground/90">
          <span className="font-bold">{title}</span>{" "}
          <span className="text-muted-foreground">
            is included in your subscription. We're connecting it to your live
            tenant data — your account team will activate it during onboarding.
          </span>
        </div>
      </div>

      <div className="glass-card p-8 text-center max-w-2xl mx-auto">
        <div className="mx-auto w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-lg font-bold tracking-tight mt-4">{title}</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {description}
        </p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {features.map((f) => (
            <div
              key={f}
              className="rounded-lg border border-border/40 bg-secondary/30 px-3 py-2 text-xs text-foreground/90 flex items-start gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
