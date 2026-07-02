---
name: Visual Workflow Canvas
description: Full reactflow-based visual node editor with drag-and-drop palette, snap-to-grid, undo/redo, conditional branching, and save
type: feature
---
The AgentWorkflows tab is a full visual workflow canvas built with @xyflow/react (reactflow v12).

Components:
- `workflow-canvas/types.ts` — WorkflowNode, WorkflowEdge, WorkflowNodeData, HistoryEntry, NODE_CATEGORIES
- `workflow-canvas/WorkflowNode.tsx` — Custom node renderer with category color bars, conditional left/right handles, enable switch
- `workflow-canvas/NodePalette.tsx` — Draggable sidebar with 9 node types (Inbound Call, Service Dispatch, Toner Check, Meter Reading, Condition Branch, E-Automate Query, Send Notification, Escalate, AI Response)
- `workflow-canvas/CanvasToolbar.tsx` — Floating toolbar with undo/redo/zoom/fit/save
- `workflow-canvas/useUndoRedo.ts` — 50-entry undo/redo stack with Ctrl+Z/Ctrl+Y keyboard shortcuts
- `AgentWorkflows.tsx` — Main canvas with ReactFlowProvider, snap-to-grid (20px), drag-and-drop from palette, and save to prompt-manager edge function

Node categories: trigger (purple), action (green), condition (yellow), output (blue)
Condition nodes have left (false/red) and right (true/green) source handles for branching.
