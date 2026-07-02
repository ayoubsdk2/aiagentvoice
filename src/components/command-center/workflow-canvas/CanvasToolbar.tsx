import { memo } from "react";
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

interface CanvasToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onSave: () => void;
  saving: boolean;
}

interface ToolItem {
  key: string;
  type: "button";
  icon: LucideIcon;
  label: string;
  prop: keyof CanvasToolbarProps;
  disabledProp?: keyof CanvasToolbarProps;
}

interface DividerItem {
  key: string;
  type: "divider";
}

type ToolEntry = ToolItem | DividerItem;

const tools: ToolEntry[] = [
  { key: "undo", type: "button", icon: Undo2, label: "Undo (Ctrl+Z)", prop: "onUndo", disabledProp: "canUndo" },
  { key: "redo", type: "button", icon: Redo2, label: "Redo (Ctrl+Y)", prop: "onRedo", disabledProp: "canRedo" },
  { key: "divider1", type: "divider" },
  { key: "zoomIn", type: "button", icon: ZoomIn, label: "Zoom In", prop: "onZoomIn" },
  { key: "zoomOut", type: "button", icon: ZoomOut, label: "Zoom Out", prop: "onZoomOut" },
  { key: "fitView", type: "button", icon: Maximize2, label: "Fit View", prop: "onFitView" },
];

function CanvasToolbar(props: CanvasToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-card/80 backdrop-blur-sm border border-border rounded-lg p-1 shadow-lg">
        {tools.map((tool) => {
          if (tool.type === "divider") {
            return <div key={tool.key} className="w-px h-5 bg-border mx-0.5" />;
          }
          const Icon = tool.icon;
          const handler = props[tool.prop] as () => void;
          const isDisabled = tool.disabledProp ? !(props[tool.disabledProp]) : false;
          return (
            <Tooltip key={tool.key}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handler}
                  disabled={isDisabled}
                  aria-label={tool.label}
                >
                  <Icon size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{tool.label}</TooltipContent>
            </Tooltip>
          );
        })}
        <div className="w-px h-5 bg-border mx-0.5" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={props.onSave} disabled={props.saving} aria-label="Save workflow">
              {props.saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Save Workflow</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

export default memo(CanvasToolbar);
