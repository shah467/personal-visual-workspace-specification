"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/state/workspace-provider";
import { useCanvasUI } from "@/state/canvas-ui-provider";
import { clamp, pointInRect, rectsIntersect, MIN_SCALE, MAX_SCALE, type Rect } from "@/lib/geometry";
import { fitViewport, focusViewport } from "@/lib/viewport";
import { NodeCard } from "./NodeCard";
import { GroupBox } from "./GroupBox";
import { ConnectionsLayer } from "./ConnectionsLayer";

type Point = { x: number; y: number };

type DragState =
  | { kind: "pan"; pointerId: number; startScreen: Point; startViewport: Point }
  | { kind: "marquee"; pointerId: number; startWorld: Point; additive: boolean }
  | {
      kind: "move-nodes";
      pointerId: number;
      startWorld: Point;
      primaryId: string;
      starts: Record<string, Point>;
      moved: boolean;
    }
  | {
      kind: "resize-node";
      pointerId: number;
      startWorld: Point;
      id: string;
      startSize: { width: number; height: number };
    }
  | {
      kind: "move-group";
      pointerId: number;
      startWorld: Point;
      groupId: string;
      groupStart: Point;
      memberStarts: Record<string, Point>;
    }
  | {
      kind: "resize-group";
      pointerId: number;
      startWorld: Point;
      groupId: string;
      startSize: { width: number; height: number };
    }
  | { kind: "connect"; pointerId: number; sourceId: string; to: Point }
  | { kind: "pinch"; scaleStart: number; distStart: number; midpoint: Point; viewportStart: Point };

const NODE_MIN = { width: 180, height: 120 };
const GROUP_MIN = { width: 220, height: 160 };

export function Canvas() {
  const workspace = useWorkspace();
  const ui = useCanvasUI();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dragStateRef = useRef<DragState | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const spaceHeldRef = useRef(false);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  const [liveNodeOverrides, setLiveNodeOverrides] = useState<Record<string, Partial<Rect>>>({});
  const [liveGroupOverrides, setLiveGroupOverrides] = useState<Record<string, Partial<Rect>>>({});
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);
  const [connectDraft, setConnectDraft] = useState<{ from: Point; to: Point } | null>(null);
  const [isSpacePan, setIsSpacePan] = useState(false);
  const [hasFitOnce, setHasFitOnce] = useState(false);

  const { viewport, setViewport } = ui;

  // Keep container size in context so the toolbar can compute fit/zoom too.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => ui.setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit the view to content once, after the first successful load.
  useEffect(() => {
    if (hasFitOnce || workspace.loading) return;
    const el = containerRef.current;
    if (!el) return;
    if (workspace.nodes.length === 0) {
      setHasFitOnce(true);
      return;
    }
    const rects = workspace.nodes.map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }));
    setViewport(fitViewport(rects, el.clientWidth, el.clientHeight));
    setHasFitOnce(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.loading, workspace.nodes.length, hasFitOnce]);

  // Handle focus requests coming from search / inspector.
  useEffect(() => {
    if (!ui.focusRequest) return;
    const node = workspace.nodes.find((n) => n.id === ui.focusRequest!.nodeId);
    const el = containerRef.current;
    if (!node || !el) return;
    setViewport((prev) =>
      focusViewport(
        { x: node.x, y: node.y, width: node.width, height: node.height },
        el.clientWidth,
        el.clientHeight,
        prev.scale,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.focusRequest]);

  // Space bar toggles pan-mode for mouse users.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingTarget(e.target)) {
        spaceHeldRef.current = true;
        setIsSpacePan(true);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !isTypingTarget(e.target)) {
        if (ui.selection.nodeIds.length) {
          e.preventDefault();
          ui.selection.nodeIds.forEach((id) => workspace.deleteNode(id));
          ui.clearSelection();
        } else if (ui.selection.connectionId) {
          e.preventDefault();
          workspace.deleteConnection(ui.selection.connectionId);
          ui.clearSelection();
        } else if (ui.selection.groupId) {
          e.preventDefault();
          workspace.deleteGroup(ui.selection.groupId);
          ui.clearSelection();
        }
      }
      if (e.key === "Escape") {
        ui.clearSelection();
        setConnectDraft(null);
        dragStateRef.current = null;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
        setIsSpacePan(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.selection]);

  const screenToWorld = useCallback(
    (sx: number, sy: number): Point => ({
      x: (sx - viewport.x) / viewport.scale,
      y: (sy - viewport.y) / viewport.scale,
    }),
    [viewport],
  );

  const getLocalPoint = useCallback((e: React.PointerEvent | PointerEvent): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // Non-passive wheel listener so we can prevent the page from scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (e.ctrlKey || e.metaKey) {
        setViewport((prev) => {
          const factor = Math.exp(-e.deltaY * 0.01);
          const nextScale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
          const ratio = nextScale / prev.scale;
          return {
            scale: nextScale,
            x: cursor.x - (cursor.x - prev.x) * ratio,
            y: cursor.y - (cursor.y - prev.y) * ratio,
          };
        });
      } else {
        setViewport((prev) => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [setViewport]);

  const nodeRectMap = useMemo(() => {
    const map = new Map<string, Rect>();
    for (const n of workspace.nodes) {
      const override = liveNodeOverrides[n.id];
      map.set(n.id, {
        x: override?.x ?? n.x,
        y: override?.y ?? n.y,
        width: override?.width ?? n.width,
        height: override?.height ?? n.height,
      });
    }
    return map;
  }, [workspace.nodes, liveNodeOverrides]);

  const groupRectMap = useMemo(() => {
    const map = new Map<string, Rect>();
    for (const g of workspace.groups) {
      const override = liveGroupOverrides[g.id];
      map.set(g.id, {
        x: override?.x ?? g.x,
        y: override?.y ?? g.y,
        width: override?.width ?? g.width,
        height: override?.height ?? g.height,
      });
    }
    return map;
  }, [workspace.groups, liveGroupOverrides]);

  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of workspace.connections) {
      counts[c.sourceId] = (counts[c.sourceId] ?? 0) + 1;
      counts[c.targetId] = (counts[c.targetId] ?? 0) + 1;
    }
    return counts;
  }, [workspace.connections]);

  // --------------------------------------------------------------------
  // Drag lifecycle
  // --------------------------------------------------------------------

  const beginCapture = useCallback((e: React.PointerEvent) => {
    containerRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.canvasBg) return;

      if (e.pointerType === "touch") {
        pointersRef.current.set(e.pointerId, getLocalPoint(e));
        if (pointersRef.current.size >= 2) {
          // A second finger just landed — upgrade (or start) into a pinch,
          // overriding any single-finger pan/drag in progress.
          const pts = Array.from(pointersRef.current.values());
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          const midpoint = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
          dragStateRef.current = {
            kind: "pinch",
            scaleStart: viewport.scale,
            distStart: dist || 1,
            midpoint,
            viewportStart: { x: viewport.x, y: viewport.y },
          };
          return;
        }
        if (dragStateRef.current) return;
        beginCapture(e);
        dragStateRef.current = {
          kind: "pan",
          pointerId: e.pointerId,
          startScreen: getLocalPoint(e),
          startViewport: { x: viewport.x, y: viewport.y },
        };
        return;
      }

      if (dragStateRef.current) return;

      if (e.button === 1 || spaceHeldRef.current) {
        beginCapture(e);
        dragStateRef.current = {
          kind: "pan",
          pointerId: e.pointerId,
          startScreen: getLocalPoint(e),
          startViewport: { x: viewport.x, y: viewport.y },
        };
        return;
      }

      if (e.button !== 0) return;
      beginCapture(e);
      const world = screenToWorld(getLocalPoint(e).x, getLocalPoint(e).y);
      dragStateRef.current = {
        kind: "marquee",
        pointerId: e.pointerId,
        startWorld: world,
        additive: e.shiftKey,
      };
      setMarqueeRect({ x: world.x, y: world.y, width: 0, height: 0 });
    },
    [beginCapture, getLocalPoint, screenToWorld, viewport],
  );

  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation();
      if (e.pointerType === "touch") {
        pointersRef.current.set(e.pointerId, getLocalPoint(e));
        if (pointersRef.current.size >= 2) {
          const pts = Array.from(pointersRef.current.values());
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          const midpoint = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
          dragStateRef.current = {
            kind: "pinch",
            scaleStart: viewport.scale,
            distStart: dist || 1,
            midpoint,
            viewportStart: { x: viewport.x, y: viewport.y },
          };
          return;
        }
      }
      beginCapture(e);
      const world = screenToWorld(getLocalPoint(e).x, getLocalPoint(e).y);

      const alreadySelected = ui.selection.nodeIds.includes(nodeId);
      const selectionIds = e.shiftKey
        ? Array.from(new Set([...ui.selection.nodeIds, nodeId]))
        : alreadySelected && ui.selection.nodeIds.length > 1
          ? ui.selection.nodeIds
          : [nodeId];

      ui.selectNodes(selectionIds);

      const starts: Record<string, Point> = {};
      for (const id of selectionIds) {
        const rect = nodeRectMap.get(id);
        if (rect) starts[id] = { x: rect.x, y: rect.y };
      }

      dragStateRef.current = {
        kind: "move-nodes",
        pointerId: e.pointerId,
        startWorld: world,
        primaryId: nodeId,
        starts,
        moved: false,
      };
    },
    [beginCapture, getLocalPoint, nodeRectMap, screenToWorld, ui],
  );

  const handleNodeResizePointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation();
      beginCapture(e);
      const world = screenToWorld(getLocalPoint(e).x, getLocalPoint(e).y);
      const rect = nodeRectMap.get(nodeId);
      dragStateRef.current = {
        kind: "resize-node",
        pointerId: e.pointerId,
        startWorld: world,
        id: nodeId,
        startSize: { width: rect?.width ?? NODE_MIN.width, height: rect?.height ?? NODE_MIN.height },
      };
    },
    [beginCapture, getLocalPoint, nodeRectMap, screenToWorld],
  );

  const handleConnectorPointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation();
      beginCapture(e);
      const world = screenToWorld(getLocalPoint(e).x, getLocalPoint(e).y);
      dragStateRef.current = { kind: "connect", pointerId: e.pointerId, sourceId: nodeId, to: world };
      setConnectDraft({ from: world, to: world });
    },
    [beginCapture, getLocalPoint, screenToWorld],
  );

  const handleGroupHeaderPointerDown = useCallback(
    (e: React.PointerEvent, groupId: string) => {
      e.stopPropagation();
      beginCapture(e);
      const world = screenToWorld(getLocalPoint(e).x, getLocalPoint(e).y);
      const rect = groupRectMap.get(groupId);
      ui.selectGroup(groupId);

      const memberStarts: Record<string, Point> = {};
      for (const n of workspace.nodes) {
        if (n.groupId === groupId) {
          const r = nodeRectMap.get(n.id);
          if (r) memberStarts[n.id] = { x: r.x, y: r.y };
        }
      }

      dragStateRef.current = {
        kind: "move-group",
        pointerId: e.pointerId,
        startWorld: world,
        groupId,
        groupStart: { x: rect?.x ?? 0, y: rect?.y ?? 0 },
        memberStarts,
      };
    },
    [beginCapture, getLocalPoint, groupRectMap, nodeRectMap, screenToWorld, ui, workspace.nodes],
  );

  const handleGroupResizePointerDown = useCallback(
    (e: React.PointerEvent, groupId: string) => {
      e.stopPropagation();
      beginCapture(e);
      const world = screenToWorld(getLocalPoint(e).x, getLocalPoint(e).y);
      const rect = groupRectMap.get(groupId);
      dragStateRef.current = {
        kind: "resize-group",
        pointerId: e.pointerId,
        startWorld: world,
        groupId,
        startSize: { width: rect?.width ?? GROUP_MIN.width, height: rect?.height ?? GROUP_MIN.height },
      };
    },
    [beginCapture, getLocalPoint, groupRectMap, screenToWorld],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragStateRef.current;

      if (e.pointerType === "touch" && pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, getLocalPoint(e));
      }

      if (!state) return;
      const local = getLocalPoint(e);

      switch (state.kind) {
        case "pan": {
          const dx = local.x - state.startScreen.x;
          const dy = local.y - state.startScreen.y;
          setViewport((prev) => ({ ...prev, x: state.startViewport.x + dx, y: state.startViewport.y + dy }));
          break;
        }
        case "pinch": {
          const pts = Array.from(pointersRef.current.values());
          if (pts.length < 2) break;
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
          const nextScale = clamp((dist / state.distStart) * state.scaleStart, MIN_SCALE, MAX_SCALE);
          const ratio = nextScale / state.scaleStart;
          setViewport({
            scale: nextScale,
            x: state.midpoint.x - (state.midpoint.x - state.viewportStart.x) * ratio,
            y: state.midpoint.y - (state.midpoint.y - state.viewportStart.y) * ratio,
          });
          break;
        }
        case "marquee": {
          const world = screenToWorld(local.x, local.y);
          const rect = {
            x: Math.min(world.x, state.startWorld.x),
            y: Math.min(world.y, state.startWorld.y),
            width: Math.abs(world.x - state.startWorld.x),
            height: Math.abs(world.y - state.startWorld.y),
          };
          setMarqueeRect(rect);
          break;
        }
        case "move-nodes": {
          const world = screenToWorld(local.x, local.y);
          const dx = world.x - state.startWorld.x;
          const dy = world.y - state.startWorld.y;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) state.moved = true;
          const overrides: Record<string, Partial<Rect>> = {};
          for (const [id, start] of Object.entries(state.starts)) {
            overrides[id] = { x: start.x + dx, y: start.y + dy };
          }
          setLiveNodeOverrides((prev) => ({ ...prev, ...overrides }));
          break;
        }
        case "resize-node": {
          const world = screenToWorld(local.x, local.y);
          const dx = world.x - state.startWorld.x;
          const dy = world.y - state.startWorld.y;
          setLiveNodeOverrides((prev) => ({
            ...prev,
            [state.id]: {
              width: Math.max(NODE_MIN.width, state.startSize.width + dx),
              height: Math.max(NODE_MIN.height, state.startSize.height + dy),
            },
          }));
          break;
        }
        case "move-group": {
          const world = screenToWorld(local.x, local.y);
          const dx = world.x - state.startWorld.x;
          const dy = world.y - state.startWorld.y;
          setLiveGroupOverrides((prev) => ({
            ...prev,
            [state.groupId]: { x: state.groupStart.x + dx, y: state.groupStart.y + dy },
          }));
          const overrides: Record<string, Partial<Rect>> = {};
          for (const [id, start] of Object.entries(state.memberStarts)) {
            overrides[id] = { x: start.x + dx, y: start.y + dy };
          }
          setLiveNodeOverrides((prev) => ({ ...prev, ...overrides }));
          break;
        }
        case "resize-group": {
          const world = screenToWorld(local.x, local.y);
          const dx = world.x - state.startWorld.x;
          const dy = world.y - state.startWorld.y;
          setLiveGroupOverrides((prev) => ({
            ...prev,
            [state.groupId]: {
              width: Math.max(GROUP_MIN.width, state.startSize.width + dx),
              height: Math.max(GROUP_MIN.height, state.startSize.height + dy),
            },
          }));
          break;
        }
        case "connect": {
          const world = screenToWorld(local.x, local.y);
          state.to = world;
          setConnectDraft((prev) => (prev ? { ...prev, to: world } : prev));
          break;
        }
      }
    },
    [getLocalPoint, screenToWorld, setViewport],
  );

  const findGroupAt = useCallback(
    (point: Point, excludeGroupId?: string) => {
      for (const g of workspace.groups) {
        if (g.id === excludeGroupId) continue;
        const rect = groupRectMap.get(g.id);
        if (rect && pointInRect(point.x, point.y, rect)) return g.id;
      }
      return null;
    },
    [workspace.groups, groupRectMap],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const state = dragStateRef.current;
      pointersRef.current.delete(e.pointerId);

      if (!state) return;
      dragStateRef.current = null;
      try {
        containerRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* no-op */
      }

      switch (state.kind) {
        case "marquee": {
          if (marqueeRect && (marqueeRect.width > 4 || marqueeRect.height > 4)) {
            const hits = workspace.nodes
              .filter((n) => rectsIntersect(marqueeRect, nodeRectMap.get(n.id)!))
              .map((n) => n.id);
            ui.selectNodes(hits, state.additive);
          } else if (!state.additive) {
            ui.clearSelection();
          }
          setMarqueeRect(null);
          break;
        }
        case "move-nodes": {
          if (!state.moved) {
            // Treat as a tap/click: handle single vs double select.
            const now = Date.now();
            const isDouble =
              lastTapRef.current?.id === state.primaryId && now - lastTapRef.current.time < 380;
            lastTapRef.current = { id: state.primaryId, time: now };
            if (isDouble) ui.focusNode(state.primaryId);
            break;
          }
          const overrides = liveNodeOverrides;
          for (const id of Object.keys(state.starts)) {
            const pos = overrides[id];
            if (!pos) continue;
            const rect = nodeRectMap.get(id);
            const node = workspace.nodes.find((n) => n.id === id);
            if (!rect || !node) continue;
            const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            const newGroupId = findGroupAt(center);
            workspace.updateNode(id, {
              x: rect.x,
              y: rect.y,
              groupId: newGroupId ?? null,
            });
          }
          setLiveNodeOverrides((prev) => {
            const next = { ...prev };
            for (const id of Object.keys(state.starts)) delete next[id];
            return next;
          });
          break;
        }
        case "resize-node": {
          const rect = nodeRectMap.get(state.id);
          if (rect) workspace.updateNode(state.id, { width: rect.width, height: rect.height });
          setLiveNodeOverrides((prev) => {
            const next = { ...prev };
            delete next[state.id];
            return next;
          });
          break;
        }
        case "move-group": {
          const rect = groupRectMap.get(state.groupId);
          if (rect) workspace.updateGroup(state.groupId, { x: rect.x, y: rect.y });
          for (const id of Object.keys(state.memberStarts)) {
            const r = nodeRectMap.get(id);
            if (r) workspace.updateNode(id, { x: r.x, y: r.y });
          }
          setLiveGroupOverrides((prev) => {
            const next = { ...prev };
            delete next[state.groupId];
            return next;
          });
          setLiveNodeOverrides((prev) => {
            const next = { ...prev };
            for (const id of Object.keys(state.memberStarts)) delete next[id];
            return next;
          });
          break;
        }
        case "resize-group": {
          const rect = groupRectMap.get(state.groupId);
          if (rect) workspace.updateGroup(state.groupId, { width: rect.width, height: rect.height });
          setLiveGroupOverrides((prev) => {
            const next = { ...prev };
            delete next[state.groupId];
            return next;
          });
          break;
        }
        case "connect": {
          const local = getLocalPoint(e);
          const world = screenToWorld(local.x, local.y);
          const target = workspace.nodes.find((n) => {
            if (n.id === state.sourceId) return false;
            const rect = nodeRectMap.get(n.id);
            return rect && pointInRect(world.x, world.y, rect);
          });
          if (target) workspace.createConnection(state.sourceId, target.id);
          setConnectDraft(null);
          break;
        }
      }
    },
    [findGroupAt, getLocalPoint, groupRectMap, liveNodeOverrides, marqueeRect, nodeRectMap, screenToWorld, ui, workspace],
  );

  const handleBackgroundDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).dataset.canvasBg) return;
      const rect = containerRef.current!.getBoundingClientRect();
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const node = workspace.createNode({
        type: "idea",
        title: "New idea",
        x: world.x - 140,
        y: world.y - 95,
      });
      ui.focusNode(node.id);
    },
    [screenToWorld, ui, workspace],
  );

  return (
    <div
      ref={containerRef}
      data-canvas-bg="true"
      className="relative h-full w-full touch-none overflow-hidden"
      style={{
        cursor: isSpacePan ? "grab" : "default",
        backgroundColor: "var(--surface-0)",
        backgroundImage: "radial-gradient(var(--grid-dot) 1px, transparent 1px)",
        backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleBackgroundDoubleClick}
    >
      <div
        className="absolute left-0 top-0 h-0 w-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {workspace.groups.map((group) => {
          const rect = groupRectMap.get(group.id)!;
          const nodeCount = workspace.nodes.filter((n) => n.groupId === group.id).length;
          return (
            <GroupBox
              key={group.id}
              group={{ ...group, ...rect }}
              selected={ui.selection.groupId === group.id}
              nodeCount={nodeCount}
              onPointerDownHeader={(e) => handleGroupHeaderPointerDown(e, group.id)}
              onPointerDownResize={(e) => handleGroupResizePointerDown(e, group.id)}
              onClick={(e) => {
                e.stopPropagation();
                ui.selectGroup(group.id);
              }}
            />
          );
        })}

        <ConnectionsLayer
          nodes={workspace.nodes.map((n) => ({ ...n, ...nodeRectMap.get(n.id)! }))}
          connections={workspace.connections}
          selectedId={ui.selection.connectionId}
          draft={connectDraft}
          onSelect={ui.selectConnection}
        />

        {workspace.nodes.map((node) => {
          const rect = nodeRectMap.get(node.id)!;
          return (
            <NodeCard
              key={node.id}
              node={{ ...node, ...rect }}
              attachments={workspace.attachmentsForNode(node.id)}
              selected={ui.selection.nodeIds.includes(node.id)}
              scale={viewport.scale}
              connectionCount={connectionCounts[node.id] ?? 0}
              onPointerDownBody={(e) => handleNodePointerDown(e, node.id)}
              onPointerDownResize={(e) => handleNodeResizePointerDown(e, node.id)}
              onPointerDownConnector={(e) => handleConnectorPointerDown(e, node.id)}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={() => ui.focusNode(node.id)}
            />
          );
        })}
      </div>

      {marqueeRect ? (
        <div
          className="pointer-events-none absolute rounded-md border border-[var(--accent)] bg-[var(--accent-soft)]"
          style={{
            left: marqueeRect.x * viewport.scale + viewport.x,
            top: marqueeRect.y * viewport.scale + viewport.y,
            width: marqueeRect.width * viewport.scale,
            height: marqueeRect.height * viewport.scale,
          }}
        />
      ) : null}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}
