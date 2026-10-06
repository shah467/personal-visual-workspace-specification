// A small durable queue for mutations made while offline. This keeps the
// sync contract explicit: nothing is silently discarded, and nothing is
// silently overwritten — the user can always see & approve what gets synced
// (spec §27/§28).

export type QueuedOp =
  | { id: string; kind: "createNode"; payload: Record<string, unknown>; tempId: string }
  | { id: string; kind: "updateNode"; payload: Record<string, unknown>; nodeId: string }
  | { id: string; kind: "deleteNode"; nodeId: string }
  | { id: string; kind: "createGroup"; payload: Record<string, unknown>; tempId: string }
  | { id: string; kind: "updateGroup"; payload: Record<string, unknown>; groupId: string }
  | { id: string; kind: "deleteGroup"; groupId: string }
  | { id: string; kind: "createConnection"; payload: Record<string, unknown>; tempId: string }
  | { id: string; kind: "deleteConnection"; connectionId: string }
  | { id: string; kind: "updateConnection"; payload: Record<string, unknown>; connectionId: string };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type QueuedOpInput = DistributiveOmit<QueuedOp, "id">;

const STORAGE_KEY = "pvw.offline-queue.v1";

function readQueue(): QueuedOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOp[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export const offlineQueue = {
  list(): QueuedOp[] {
    return readQueue();
  },
  enqueue(op: QueuedOpInput) {
    const queue = readQueue();
    const withId = { ...op, id: crypto.randomUUID() } as QueuedOp;
    queue.push(withId);
    writeQueue(queue);
    return withId;
  },
  remove(id: string) {
    writeQueue(readQueue().filter((op) => op.id !== id));
  },
  clear() {
    writeQueue([]);
  },
  count(): number {
    return readQueue().length;
  },
};

export function isNetworkError(error: unknown) {
  return error instanceof TypeError;
}
