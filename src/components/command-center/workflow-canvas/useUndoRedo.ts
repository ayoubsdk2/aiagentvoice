import { useState, useCallback, useRef } from "react";
import type { WorkflowNode, WorkflowEdge, HistoryEntry } from "./types";

const MAX_HISTORY = 50;

export function useUndoRedo(initialNodes: WorkflowNode[], initialEdges: WorkflowEdge[]) {
  const [history, setHistory] = useState<HistoryEntry[]>([
    { nodes: initialNodes, edges: initialEdges },
  ]);
  const [pointer, setPointer] = useState(0);
  const batchRef = useRef(false);

  const pushHistory = useCallback((nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    if (batchRef.current) return;
    setHistory((prev) => {
      const trimmed = prev.slice(0, pointer + 1);
      const next = [...trimmed, { nodes: structuredClone(nodes), edges: structuredClone(edges) }];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setPointer((p) => Math.min(p + 1, MAX_HISTORY - 1));
  }, [pointer]);

  const undo = useCallback((): HistoryEntry | null => {
    if (pointer <= 0) return null;
    const newPointer = pointer - 1;
    setPointer(newPointer);
    return structuredClone(history[newPointer]);
  }, [history, pointer]);

  const redo = useCallback((): HistoryEntry | null => {
    if (pointer >= history.length - 1) return null;
    const newPointer = pointer + 1;
    setPointer(newPointer);
    return structuredClone(history[newPointer]);
  }, [history, pointer]);

  const canUndo = pointer > 0;
  const canRedo = pointer < history.length - 1;

  return { pushHistory, undo, redo, canUndo, canRedo };
}
