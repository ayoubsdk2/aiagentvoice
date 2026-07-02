import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Wrench, Droplets, FileText, Zap, GitBranch, Send, Phone,
  Search, MessageSquare, AlertTriangle, type LucideIcon,
} from "lucide-react";
import { NODE_CATEGORIES, type WorkflowNodeData } from "./types";

const ICON_MAP: Record<string, LucideIcon> = {
  Wrench, Droplets, FileText, Zap, GitBranch, Send, Phone,
  Search, MessageSquare, AlertTriangle,
};

function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as WorkflowNodeData;
  const category = NODE_CATEGORIES[d.category];
  const Icon = ICON_MAP[d.icon] ?? Zap;

  return (
    <div
      className={`
        relative rounded-xl border bg-card/90 backdrop-blur-sm p-4 min-w-[220px] max-w-[260px]
        transition-all duration-200 group
        ${selected ? "ring-2 ring-primary shadow-lg shadow-primary/20" : "border-border/50 hover:border-primary/40"}
      `}
    >
      <div
        className="absolute top-0 left-4 w-8 h-1 rounded-b-full"
        style={{ backgroundColor: category.color }}
      />

      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-card hover:!bg-primary transition-colors"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-card hover:!bg-primary transition-colors"
      />

      {d.category === "condition" && (
        <>
          <Handle
            type="source"
            position={Position.Left}
            id="false"
            className="!w-3 !h-3 !bg-destructive !border-2 !border-card"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="!w-3 !h-3 !bg-[hsl(var(--success))] !border-2 !border-card"
          />
        </>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="p-2 rounded-lg shrink-0"
            style={{ backgroundColor: `${category.color}20`, color: category.color }}
          >
            <Icon size={18} />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground leading-tight">{d.label}</span>
              {d.badge && (
                <Badge variant="outline" className="text-[8px] font-mono uppercase tracking-wider border-border shrink-0">
                  {d.badge}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
              {d.description}
            </p>
            {d.params.length > 0 && (
              <div className="flex gap-1 flex-wrap pt-0.5">
                {d.params.map((p: string) => (
                  <span key={p} className="text-[9px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <Switch
          checked={d.enabled}
          className="shrink-0 scale-90"
          onCheckedChange={() => {}}
        />
      </div>
    </div>
  );
}

export default memo(WorkflowNodeComponent);
