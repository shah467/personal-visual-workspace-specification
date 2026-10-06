// ---------------------------------------------------------------------------
// Core domain types. These describe the Workspace data model independently
// from any canvas/UI implementation (spec §4 / §35).
// ---------------------------------------------------------------------------

export type NodeType =
  | "idea"
  | "project"
  | "business"
  | "product"
  | "goal"
  | "research"
  | "resource"
  | "person"
  | "company"
  | "document"
  | "note";

export const NODE_TYPES: { value: NodeType; label: string; icon: string }[] = [
  { value: "idea", label: "Idea", icon: "✦" },
  { value: "project", label: "Project", icon: "◧" },
  { value: "business", label: "Business", icon: "◆" },
  { value: "product", label: "Product", icon: "▣" },
  { value: "goal", label: "Goal", icon: "◎" },
  { value: "research", label: "Research", icon: "⌕" },
  { value: "resource", label: "Resource", icon: "⬡" },
  { value: "person", label: "Person", icon: "☺" },
  { value: "company", label: "Company", icon: "▦" },
  { value: "document", label: "Document", icon: "▤" },
  { value: "note", label: "Note", icon: "▱" },
];

export type NodeColor =
  | "neutral"
  | "amber"
  | "rose"
  | "violet"
  | "sky"
  | "emerald"
  | "slate";

export type AttachmentKind = "image" | "file" | "audio" | "link";

export interface Attachment {
  id: string;
  nodeId: string;
  kind: AttachmentKind;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  title: string;
  content: string;
  color: NodeColor;
  x: number;
  y: number;
  width: number;
  height: number;
  groupId: string | null;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  style: {
    dashed?: boolean;
    thickness?: number;
    directed?: boolean;
    color?: string;
  };
  createdAt: string;
}

export interface Group {
  id: string;
  title: string;
  color: NodeColor;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  nodes: GraphNode[];
  connections: Connection[];
  groups: Group[];
  attachments: Attachment[];
}
