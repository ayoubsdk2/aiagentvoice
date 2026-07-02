import { memo } from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  trend: string;
  icon: LucideIcon;
}

export const MetricCard = memo(function MetricCard({ title, value, trend, icon: Icon }: MetricCardProps) {
  return (
    <div className="glass-card p-5 hover-lift focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-1 focus-within:ring-offset-background rounded-xl">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          <Icon size={20} />
        </div>
        <span className="text-success text-sm font-mono font-bold">{trend}</span>
      </div>
      <div className="text-3xl font-bold tracking-tighter text-foreground tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1.5">{title}</div>
    </div>
  );
});
