import type { Node, Edge } from "@xyflow/react";

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  icon: string; // lucide icon name
  category: "trigger" | "action" | "condition" | "output";
  enabled: boolean;
  params: string[];
  badge?: string;
}

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

export interface HistoryEntry {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export const NODE_CATEGORIES = {
  trigger: { label: "Trigger", color: "hsl(270, 70%, 55%)" },
  action: { label: "Action", color: "hsl(160, 60%, 45%)" },
  condition: { label: "Condition", color: "hsl(38, 92%, 50%)" },
  output: { label: "Output", color: "hsl(200, 80%, 50%)" },
} as const;
