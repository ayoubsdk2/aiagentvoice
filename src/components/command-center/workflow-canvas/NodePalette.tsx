import { memo } from "react";
import {
  Wrench, Droplets, FileText, Zap, GitBranch, Send, Phone,
  Search, MessageSquare, AlertTriangle, GripVertical, type LucideIcon,
} from "lucide-react";
import { NODE_CATEGORIES, type WorkflowNodeData } from "./types";

const ICON_MAP: Record<string, LucideIcon> = {
  Wrench, Droplets, FileText, Zap, GitBranch, Send, Phone,
  Search, MessageSquare, AlertTriangle,
};

interface PaletteItem {
  label: string;
  description: string;
  icon: string;
  category: "trigger" | "action" | "condition" | "output";
  params: string[];
  badge?: string;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    label: "Inbound Call",
    description: "Triggers when a new call is received",
    icon: "Phone",
    category: "trigger",
    params: ["caller_id"],
    badge: "Entry",
  },
  {
    label: "Service Dispatch",
    description: "Dispatch field tech based on serial & error code",
    icon: "Wrench",
    category: "action",
    params: ["serial_number", "error_code"],
    badge: "Critical",
  },
  {
    label: "Toner Check",
    description: "Query toner levels; auto-replenish if <15%",
    icon: "Droplets",
    category: "action",
    params: ["device_id"],
    badge: "Auto",
  },
  {
    label: "Meter Reading",
    description: "Collect & validate B&W page counter readings",
    icon: "FileText",
    category: "action",
    params: ["serial_number", "bw_count"],
    badge: "Billing",
  },
  {
    label: "Condition Branch",
    description: "Route flow based on a condition evaluation",
    icon: "GitBranch",
    category: "condition",
    params: ["expression"],
    badge: "Logic",
  },
  {
    label: "E-Automate Query",
    description: "Query service history & contract details",
    icon: "Search",
    category: "action",
    params: ["query_type", "asset_id"],
  },
  {
    label: "Send Notification",
    description: "Send email/SMS notification to stakeholder",
    icon: "Send",
    category: "output",
    params: ["recipient", "template"],
  },
  {
    label: "Escalate",
    description: "Escalate to human agent with context",
    icon: "AlertTriangle",
    category: "output",
    params: ["priority", "reason"],
    badge: "Fallback",
  },
  {
    label: "AI Response",
    description: "Generate contextual voice response",
    icon: "MessageSquare",
    category: "action",
    params: ["context"],
  },
];

function NodePalette() {
  const onDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-[240px] shrink-0 border-r border-border bg-card/50 flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Node Palette</h3>
        <p className="text-[10px] text-muted-foreground mt-1">Drag nodes onto the canvas</p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
        {PALETTE_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon] ?? Zap;
          const cat = NODE_CATEGORIES[item.category];
          return (
            <div
              key={item.label}
              draggable
              onDragStart={(e) => onDragStart(e, item)}
              className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/50 border border-border/30 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:bg-secondary transition-all group"
            >
              <GripVertical size={12} className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
              <div className="p-1.5 rounded-md shrink-0" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                <Icon size={14} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-foreground block truncate">{item.label}</span>
                <span className="text-[9px] text-muted-foreground block truncate">{item.description}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(NodePalette);
