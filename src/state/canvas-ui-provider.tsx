"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export type SelectionKind = "node" | "group" | "connection" | null;

interface Selection {
  kind: SelectionKind;
  nodeIds: string[];
  groupId: string | null;
  connectionId: string | null;
}

interface FocusRequest {
  nodeId: string;
  token: number;
}

interface CanvasUIContextValue {
  viewport: Viewport;
  setViewport: (v: Viewport | ((prev: Viewport) => Viewport)) => void;
  selection: Selection;
  selectNodes: (ids: string[], additive?: boolean) => void;
  toggleNodeSelection: (id: string) => void;
  selectGroup: (id: string | null) => void;
  selectConnection: (id: string | null) => void;
  clearSelection: () => void;
  inspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
  inspectorCollapsed: boolean;
  setInspectorCollapsed: (collapsed: boolean) => void;
  inspectorWidth: number;
  setInspectorWidth: (width: number) => void;
  focusRequest: FocusRequest | null;
  focusNode: (nodeId: string) => void;
  clearFocusRequest: () => void;
  containerSize: { width: number; height: number };
  setContainerSize: (size: { width: number; height: number }) => void;
}

const DEFAULT_SELECTION: Selection = {
  kind: null,
  nodeIds: [],
  groupId: null,
  connectionId: null,
};

const CanvasUIContext = createContext<CanvasUIContextValue | null>(null);

export function CanvasUIProvider({ children }: { children: ReactNode }) {
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [selection, setSelection] = useState<Selection>(DEFAULT_SELECTION);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(380);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });

  const selectNodes = useCallback((ids: string[], additive = false) => {
    setSelection((prev) => {
      if (!additive) {
        return { kind: ids.length ? "node" : null, nodeIds: ids, groupId: null, connectionId: null };
      }
      const merged = Array.from(new Set([...prev.nodeIds, ...ids]));
      return { kind: "node", nodeIds: merged, groupId: null, connectionId: null };
    });
    if (ids.length) setInspectorOpen(true);
  }, []);

  const toggleNodeSelection = useCallback((id: string) => {
    setSelection((prev) => {
      const exists = prev.nodeIds.includes(id);
      const nodeIds = exists ? prev.nodeIds.filter((n) => n !== id) : [...prev.nodeIds, id];
      return { kind: nodeIds.length ? "node" : null, nodeIds, groupId: null, connectionId: null };
    });
  }, []);

  const selectGroup = useCallback((id: string | null) => {
    setSelection({ kind: id ? "group" : null, nodeIds: [], groupId: id, connectionId: null });
    if (id) setInspectorOpen(true);
  }, []);

  const selectConnection = useCallback((id: string | null) => {
    setSelection({ kind: id ? "connection" : null, nodeIds: [], groupId: null, connectionId: id });
    if (id) setInspectorOpen(true);
  }, []);

  const clearSelection = useCallback(() => setSelection(DEFAULT_SELECTION), []);

  const focusNode = useCallback((nodeId: string) => {
    setFocusRequest({ nodeId, token: Date.now() });
    setSelection({ kind: "node", nodeIds: [nodeId], groupId: null, connectionId: null });
    setInspectorOpen(true);
  }, []);

  const clearFocusRequest = useCallback(() => setFocusRequest(null), []);

  const value = useMemo<CanvasUIContextValue>(
    () => ({
      viewport,
      setViewport,
      selection,
      selectNodes,
      toggleNodeSelection,
      selectGroup,
      selectConnection,
      clearSelection,
      inspectorOpen,
      setInspectorOpen,
      inspectorCollapsed,
      setInspectorCollapsed,
      inspectorWidth,
      setInspectorWidth,
      focusRequest,
      focusNode,
      clearFocusRequest,
      containerSize,
      setContainerSize,
    }),
    [
      viewport,
      selection,
      selectNodes,
      toggleNodeSelection,
      selectGroup,
      selectConnection,
      clearSelection,
      inspectorOpen,
      inspectorCollapsed,
      inspectorWidth,
      focusRequest,
      focusNode,
      clearFocusRequest,
      containerSize,
    ],
  );

  return <CanvasUIContext.Provider value={value}>{children}</CanvasUIContext.Provider>;
}

export function useCanvasUI() {
  const ctx = useContext(CanvasUIContext);
  if (!ctx) throw new Error("useCanvasUI must be used within CanvasUIProvider");
  return ctx;
}
