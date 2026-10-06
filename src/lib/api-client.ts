import type { Attachment, Connection, GraphNode, Group, WorkspaceSnapshot } from "@/types/graph";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData)
      ? { "Content-Type": "application/json", ...(init.headers ?? {}) }
      : init?.headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getWorkspace: () => request<WorkspaceSnapshot>("/api/workspace"),

  createNode: (payload: Partial<GraphNode>) =>
    request<GraphNode>("/api/nodes", { method: "POST", body: JSON.stringify(payload) }),
  updateNode: (id: string, payload: Partial<GraphNode>) =>
    request<GraphNode>(`/api/nodes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteNode: (id: string) => request<{ ok: true }>(`/api/nodes/${id}`, { method: "DELETE" }),

  createGroup: (payload: Partial<Group>) =>
    request<Group>("/api/groups", { method: "POST", body: JSON.stringify(payload) }),
  updateGroup: (id: string, payload: Partial<Group>) =>
    request<Group>(`/api/groups/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteGroup: (id: string) => request<{ ok: true }>(`/api/groups/${id}`, { method: "DELETE" }),

  createConnection: (payload: Partial<Connection> & { sourceId: string; targetId: string }) =>
    request<Connection>("/api/connections", { method: "POST", body: JSON.stringify(payload) }),
  updateConnection: (id: string, payload: Partial<Connection>) =>
    request<Connection>(`/api/connections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteConnection: (id: string) =>
    request<{ ok: true }>(`/api/connections/${id}`, { method: "DELETE" }),

  uploadAttachment: (nodeId: string, kind: string, file: File) => {
    const formData = new FormData();
    formData.append("nodeId", nodeId);
    formData.append("kind", kind);
    formData.append("file", file);
    return request<Attachment>("/api/attachments", { method: "POST", body: formData });
  },
  createLinkAttachment: (nodeId: string, url: string, name?: string) =>
    request<Attachment>("/api/attachments", {
      method: "POST",
      body: JSON.stringify({ nodeId, url, name, kind: "link" }),
    }),
  deleteAttachment: (id: string) =>
    request<{ ok: true }>(`/api/attachments/${id}`, { method: "DELETE" }),
};
