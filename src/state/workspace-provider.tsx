"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api } from "@/lib/api-client";
import { offlineQueue, isNetworkError, type QueuedOp } from "@/lib/offline-queue";
import type { Attachment, Connection, GraphNode, Group, NodeColor, NodeType } from "@/types/graph";

interface WorkspaceContextValue {
  nodes: GraphNode[];
  connections: Connection[];
  groups: Group[];
  attachments: Attachment[];
  loading: boolean;
  loadError: string | null;
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  lastSyncError: string | null;
  attachmentsForNode: (nodeId: string) => Attachment[];
  createNode: (input: Partial<GraphNode> & { type: NodeType }) => GraphNode;
  updateNode: (id: string, patch: Partial<GraphNode>) => void;
  deleteNode: (id: string) => void;
  createGroup: (input: Partial<Group>) => Group;
  updateGroup: (id: string, patch: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  createConnection: (sourceId: string, targetId: string) => Connection | null;
  updateConnection: (id: string, patch: Partial<Connection>) => void;
  deleteConnection: (id: string) => void;
  uploadAttachment: (nodeId: string, kind: "image" | "file" | "audio", file: File) => Promise<void>;
  addLinkAttachment: (nodeId: string, url: string, name?: string) => Promise<void>;
  removeAttachment: (id: string) => Promise<void>;
  reviewSync: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function nowIso() {
  return new Date().toISOString();
}

function makeOptimisticNode(input: Partial<GraphNode> & { type: NodeType }): GraphNode {
  return {
    id: input.id ?? crypto.randomUUID(),
    type: input.type,
    title: input.title ?? "",
    content: input.content ?? "",
    color: (input.color as NodeColor) ?? "neutral",
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? 280,
    height: input.height ?? 190,
    groupId: input.groupId ?? null,
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function makeOptimisticGroup(input: Partial<Group>): Group {
  return {
    id: input.id ?? crypto.randomUUID(),
    title: input.title ?? "Untitled Group",
    color: (input.color as NodeColor) ?? "neutral",
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? 480,
    height: input.height ?? 360,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const refreshPendingCount = useCallback(() => setPendingCount(offlineQueue.count()), []);

  useEffect(() => {
    refreshPendingCount();
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refreshPendingCount]);

  useEffect(() => {
    let cancelled = false;
    api
      .getWorkspace()
      .then((snapshot) => {
        if (cancelled) return;
        setNodes(snapshot.nodes);
        setConnections(snapshot.connections);
        setGroups(snapshot.groups);
        setAttachments(snapshot.attachments);
        try {
          window.localStorage.setItem("pvw.workspace-cache.v1", JSON.stringify(snapshot));
        } catch {
          /* ignore quota errors */
        }
      })
      .catch((error) => {
        if (cancelled) return;
        // Fall back to the last cached snapshot so the app stays usable offline.
        try {
          const cached = window.localStorage.getItem("pvw.workspace-cache.v1");
          if (cached) {
            const snapshot = JSON.parse(cached);
            setNodes(snapshot.nodes ?? []);
            setConnections(snapshot.connections ?? []);
            setGroups(snapshot.groups ?? []);
            setAttachments(snapshot.attachments ?? []);
            setLoadError("You're viewing a cached version of your workspace (offline).");
          } else {
            setLoadError(error.message ?? "Failed to load workspace");
          }
        } catch {
          setLoadError(error.message ?? "Failed to load workspace");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const attachmentsForNode = useCallback(
    (nodeId: string) => attachments.filter((a) => a.nodeId === nodeId),
    [attachments],
  );

  // ----- Nodes -----------------------------------------------------------
  const createNode = useCallback((input: Partial<GraphNode> & { type: NodeType }) => {
    const node = makeOptimisticNode(input);
    setNodes((prev) => [...prev, node]);

    api
      .createNode(node)
      .catch((error) => {
        if (isNetworkError(error)) {
          offlineQueue.enqueue({ kind: "createNode", payload: node as unknown as Record<string, unknown>, tempId: node.id });
          refreshPendingCount();
        } else {
          console.error(error);
        }
      });

    return node;
  }, [refreshPendingCount]);

  const updateNode = useCallback((id: string, patch: Partial<GraphNode>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: nowIso() } : n)),
    );
    api.updateNode(id, patch).catch((error) => {
      if (isNetworkError(error)) {
        offlineQueue.enqueue({ kind: "updateNode", payload: patch, nodeId: id });
        refreshPendingCount();
      } else {
        console.error(error);
      }
    });
  }, [refreshPendingCount]);

  const deleteNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setConnections((prev) => prev.filter((c) => c.sourceId !== id && c.targetId !== id));
    setAttachments((prev) => prev.filter((a) => a.nodeId !== id));
    api.deleteNode(id).catch((error) => {
      if (isNetworkError(error)) {
        offlineQueue.enqueue({ kind: "deleteNode", nodeId: id });
        refreshPendingCount();
      } else {
        console.error(error);
      }
    });
  }, [refreshPendingCount]);

  // ----- Groups ------------------------------------------------------------
  const createGroup = useCallback((input: Partial<Group>) => {
    const group = makeOptimisticGroup(input);
    setGroups((prev) => [...prev, group]);
    api.createGroup(group).catch((error) => {
      if (isNetworkError(error)) {
        offlineQueue.enqueue({ kind: "createGroup", payload: group as unknown as Record<string, unknown>, tempId: group.id });
        refreshPendingCount();
      } else {
        console.error(error);
      }
    });
    return group;
  }, [refreshPendingCount]);

  const updateGroup = useCallback((id: string, patch: Partial<Group>) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: nowIso() } : g)),
    );
    api.updateGroup(id, patch).catch((error) => {
      if (isNetworkError(error)) {
        offlineQueue.enqueue({ kind: "updateGroup", payload: patch, groupId: id });
        refreshPendingCount();
      } else {
        console.error(error);
      }
    });
  }, [refreshPendingCount]);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setNodes((prev) => prev.map((n) => (n.groupId === id ? { ...n, groupId: null } : n)));
    api.deleteGroup(id).catch((error) => {
      if (isNetworkError(error)) {
        offlineQueue.enqueue({ kind: "deleteGroup", groupId: id });
        refreshPendingCount();
      } else {
        console.error(error);
      }
    });
  }, [refreshPendingCount]);

  // ----- Connections ---------------------------------------------------
  const createConnection = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return null;
      const already = connections.find(
        (c) =>
          (c.sourceId === sourceId && c.targetId === targetId) ||
          (c.sourceId === targetId && c.targetId === sourceId),
      );
      if (already) return already;

      const connection: Connection = {
        id: crypto.randomUUID(),
        sourceId,
        targetId,
        label: "",
        style: {},
        createdAt: nowIso(),
      };
      setConnections((prev) => [...prev, connection]);
      api.createConnection(connection).catch((error) => {
        if (isNetworkError(error)) {
          offlineQueue.enqueue({
            kind: "createConnection",
            payload: connection as unknown as Record<string, unknown>,
            tempId: connection.id,
          });
          refreshPendingCount();
        } else {
          console.error(error);
        }
      });
      return connection;
    },
    [connections, refreshPendingCount],
  );

  const updateConnection = useCallback((id: string, patch: Partial<Connection>) => {
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    api.updateConnection(id, patch).catch((error) => {
      if (isNetworkError(error)) {
        offlineQueue.enqueue({
          kind: "updateConnection",
          payload: patch as unknown as Record<string, unknown>,
          connectionId: id,
        });
        refreshPendingCount();
      } else {
        console.error(error);
      }
    });
  }, [refreshPendingCount]);

  const deleteConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
    api.deleteConnection(id).catch((error) => {
      if (isNetworkError(error)) {
        offlineQueue.enqueue({ kind: "deleteConnection", connectionId: id });
        refreshPendingCount();
      } else {
        console.error(error);
      }
    });
  }, [refreshPendingCount]);

  // ----- Attachments -----------------------------------------------------
  const uploadAttachment = useCallback(
    async (nodeId: string, kind: "image" | "file" | "audio", file: File) => {
      const attachment = await api.uploadAttachment(nodeId, kind, file);
      setAttachments((prev) => [...prev, attachment]);
    },
    [],
  );

  const addLinkAttachment = useCallback(async (nodeId: string, url: string, name?: string) => {
    const attachment = await api.createLinkAttachment(nodeId, url, name);
    setAttachments((prev) => [...prev, attachment]);
  }, []);

  const removeAttachment = useCallback(async (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    await api.deleteAttachment(id);
  }, []);

  // ----- Manual sync review ----------------------------------------------
  const reviewSync = useCallback(async () => {
    setSyncing(true);
    setLastSyncError(null);
    const queue: QueuedOp[] = offlineQueue.list();
    try {
      for (const op of queue) {
        switch (op.kind) {
          case "createNode":
            await api.createNode(op.payload as Partial<GraphNode>);
            break;
          case "updateNode":
            await api.updateNode(op.nodeId, op.payload as Partial<GraphNode>);
            break;
          case "deleteNode":
            await api.deleteNode(op.nodeId).catch(() => undefined);
            break;
          case "createGroup":
            await api.createGroup(op.payload as Partial<Group>);
            break;
          case "updateGroup":
            await api.updateGroup(op.groupId, op.payload as Partial<Group>);
            break;
          case "deleteGroup":
            await api.deleteGroup(op.groupId).catch(() => undefined);
            break;
          case "createConnection":
            await api.createConnection(
              op.payload as Partial<Connection> & { sourceId: string; targetId: string },
            );
            break;
          case "deleteConnection":
            await api.deleteConnection(op.connectionId).catch(() => undefined);
            break;
          case "updateConnection":
            await api.updateConnection(op.connectionId, op.payload as Partial<Connection>);
            break;
        }
        offlineQueue.remove(op.id);
      }
      refreshPendingCount();
    } catch (error) {
      setLastSyncError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [refreshPendingCount]);

  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (online && offlineQueue.count() > 0 && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
    }
  }, [online]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      nodes,
      connections,
      groups,
      attachments,
      loading,
      loadError,
      online,
      pendingCount,
      syncing,
      lastSyncError,
      attachmentsForNode,
      createNode,
      updateNode,
      deleteNode,
      createGroup,
      updateGroup,
      deleteGroup,
      createConnection,
      updateConnection,
      deleteConnection,
      uploadAttachment,
      addLinkAttachment,
      removeAttachment,
      reviewSync,
    }),
    [
      nodes,
      connections,
      groups,
      attachments,
      loading,
      loadError,
      online,
      pendingCount,
      syncing,
      lastSyncError,
      attachmentsForNode,
      createNode,
      updateNode,
      deleteNode,
      createGroup,
      updateGroup,
      deleteGroup,
      createConnection,
      updateConnection,
      deleteConnection,
      uploadAttachment,
      addLinkAttachment,
      removeAttachment,
      reviewSync,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
