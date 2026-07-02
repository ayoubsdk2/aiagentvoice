import { useCallback, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type NodeTypes,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import WorkflowNodeComponent from "./workflow-canvas/WorkflowNode";
import NodePalette from "./workflow-canvas/NodePalette";
import CanvasToolbar from "./workflow-canvas/CanvasToolbar";
import { useUndoRedo } from "./workflow-canvas/useUndoRedo";
import type { WorkflowNode, WorkflowEdge, WorkflowNodeData } from "./workflow-canvas/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const nodeTypes: NodeTypes = {
  workflow: WorkflowNodeComponent,
};

const INITIAL_NODES: WorkflowNode[] = [
  {
    id: "trigger-1",
    type: "workflow",
    position: { x: 300, y: 40 },
    data: {
      label: "Inbound Call",
      description: "Triggers when a new call is received",
      icon: "Phone",
      category: "trigger",
      enabled: true,
      params: ["caller_id"],
      badge: "Entry",
    },
  },
  {
    id: "condition-1",
    type: "workflow",
    position: { x: 280, y: 200 },
    data: {
      label: "Error Code?",
      description: "Check if caller reports an error code",
      icon: "GitBranch",
      category: "condition",
      enabled: true,
      params: ["expression"],
      badge: "Logic",
    },
  },
  {
    id: "action-dispatch",
    type: "workflow",
    position: { x: 520, y: 380 },
    data: {
      label: "Service Dispatch",
      description: "Dispatch field tech based on serial & error code",
      icon: "Wrench",
      category: "action",
      enabled: true,
      params: ["serial_number", "error_code"],
      badge: "Critical",
    },
  },
  {
    id: "action-toner",
    type: "workflow",
    position: { x: 60, y: 380 },
    data: {
      label: "Toner Check",
      description: "Query toner levels; auto-replenish if <15%",
      icon: "Droplets",
      category: "action",
      enabled: true,
      params: ["device_id"],
      badge: "Auto",
    },
  },
  {
    id: "output-1",
    type: "workflow",
    position: { x: 300, y: 560 },
    data: {
      label: "Send Notification",
      description: "Send summary email to stakeholder",
      icon: "Send",
      category: "output",
      enabled: true,
      params: ["recipient", "template"],
    },
  },
];

const INITIAL_EDGES: WorkflowEdge[] = [
  { id: "e-trigger-cond", source: "trigger-1", target: "condition-1", animated: true, style: { stroke: "hsl(270, 70%, 55%)" } },
  { id: "e-cond-dispatch", source: "condition-1", target: "action-dispatch", sourceHandle: "true", animated: true, style: { stroke: "hsl(160, 60%, 45%)" }, label: "Yes" },
  { id: "e-cond-toner", source: "condition-1", target: "action-toner", sourceHandle: "false", animated: true, style: { stroke: "hsl(38, 92%, 50%)" }, label: "No" },
  { id: "e-dispatch-out", source: "action-dispatch", target: "output-1", style: { stroke: "hsl(200, 80%, 50%)" } },
  { id: "e-toner-out", source: "action-toner", target: "output-1", style: { stroke: "hsl(200, 80%, 50%)" } },
];

function WorkflowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(INITIAL_EDGES);
  const [saving, setSaving] = useState(false);
  const { pushHistory, undo, redo, canUndo, canRedo } = useUndoRedo(INITIAL_NODES, INITIAL_EDGES);
  const { zoomIn, zoomOut, fitView, screenToFlowPosition } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Push history on meaningful changes
  const onNodesChangeWrapped = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      const hasMeaningful = changes.some(
        (c) => c.type === "position" && c.dragging === false
      );
      if (hasMeaningful) {
        // Use timeout to get updated state
        setTimeout(() => {
          setNodes((n) => {
            setEdges((e) => {
              pushHistory(n, e);
              return e;
            });
            return n;
          });
        }, 0);
      }
    },
    [onNodesChange, pushHistory, setNodes, setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const edge: WorkflowEdge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        animated: true,
        style: { stroke: "hsl(270, 70%, 55%)" },
      };
      setEdges((eds) => addEdge(edge, eds));
      setTimeout(() => {
        setNodes((n) => {
          setEdges((e) => {
            pushHistory(n, e);
            return e;
          });
          return n;
        });
      }, 0);
    },
    [setEdges, setNodes, pushHistory]
  );

  // Drop handler for palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/reactflow");
      if (!raw) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse(raw) as any;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: WorkflowNode = {
        id: `${String(parsed.category)}-${Date.now()}`,
        type: "workflow",
        position,
        data: {
          label: String(parsed.label),
          description: String(parsed.description),
          icon: String(parsed.icon),
          category: parsed.category as WorkflowNodeData["category"],
          params: parsed.params as string[],
          badge: parsed.badge ? String(parsed.badge) : undefined,
          enabled: true,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setTimeout(() => {
        setNodes((n) => {
          setEdges((e) => {
            pushHistory(n, e);
            return e;
          });
          return n;
        });
      }, 50);
    },
    [screenToFlowPosition, setNodes, setEdges, pushHistory]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const entry = undo();
        if (entry) { setNodes(entry.nodes); setEdges(entry.edges); }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        const entry = redo();
        if (entry) { setNodes(entry.nodes); setEdges(entry.edges); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, setNodes, setEdges]);

  const handleUndo = useCallback(() => {
    const entry = undo();
    if (entry) { setNodes(entry.nodes); setEdges(entry.edges); }
  }, [undo, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    const entry = redo();
    if (entry) { setNodes(entry.nodes); setEdges(entry.edges); }
  }, [redo, setNodes, setEdges]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Build tool config from enabled action nodes
      const config: Record<string, boolean> = {};
      nodes.forEach((n) => {
        if (n.data.category === "action") {
          const key = n.data.label.toLowerCase().replace(/\s+/g, "_");
          config[key] = n.data.enabled;
        }
      });
      await supabase.functions.invoke("prompt-manager", {
        body: { action: "save_tool_config", config },
      });
      toast.success("Workflow saved successfully");
    } catch {
      toast.error("Failed to save workflow");
    } finally {
      setSaving(false);
    }
  }, [nodes]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-[calc(100vh-140px)]"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Agentic Workflow Canvas</h2>
          <p className="text-sm text-muted-foreground">
            Drag nodes from the palette, connect them to build conditional voice workflows.
          </p>
        </div>
      </div>

      <div className="flex-1 flex rounded-xl border border-border overflow-hidden bg-background">
        {/* Sidebar palette */}
        <NodePalette />

        {/* Canvas */}
        <div ref={reactFlowWrapper} className="flex-1 relative">
          <CanvasToolbar
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onZoomIn={() => zoomIn()}
            onZoomOut={() => zoomOut()}
            onFitView={() => fitView({ padding: 0.2 })}
            onSave={handleSave}
            saving={saving}
          />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChangeWrapped}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            snapToGrid
            snapGrid={[20, 20]}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-background"
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(260, 10%, 18%)" />
            <Controls
              showInteractive={false}
              className="!bg-card/80 !border-border !rounded-lg !shadow-lg [&>button]:!bg-transparent [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-secondary"
            />
          </ReactFlow>
        </div>
      </div>
    </motion.div>
  );
}

export function AgentWorkflows() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas />
    </ReactFlowProvider>
  );
}
