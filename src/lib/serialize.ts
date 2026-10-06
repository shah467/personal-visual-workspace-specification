import type { nodes, connections, groups, attachments } from "@/db/schema";
import type { GraphNode, Connection, Group, Attachment } from "@/types/graph";

type NodeRow = typeof nodes.$inferSelect;
type ConnectionRow = typeof connections.$inferSelect;
type GroupRow = typeof groups.$inferSelect;
type AttachmentRow = typeof attachments.$inferSelect;

export function serializeNode(row: NodeRow): GraphNode {
  return {
    id: row.id,
    type: row.type as GraphNode["type"],
    title: row.title,
    content: row.content,
    color: row.color as GraphNode["color"],
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    groupId: row.groupId ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeConnection(row: ConnectionRow): Connection {
  return {
    id: row.id,
    sourceId: row.sourceId,
    targetId: row.targetId,
    label: row.label,
    style: row.style ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeGroup(row: GroupRow): Group {
  return {
    id: row.id,
    title: row.title,
    color: row.color as Group["color"],
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    nodeId: row.nodeId,
    kind: row.kind as Attachment["kind"],
    url: row.url,
    name: row.name,
    mimeType: row.mimeType,
    size: row.size,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}
