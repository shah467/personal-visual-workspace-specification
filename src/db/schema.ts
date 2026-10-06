import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  jsonb,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Personal Visual Workspace — Data Model
// Canvas is only a *view* of this data. Nothing here is coupled to any
// particular rendering/canvas implementation (see spec section 35).
// ---------------------------------------------------------------------------

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull().default("Untitled Group"),
  color: text("color").notNull().default("neutral"),
  x: doublePrecision("x").notNull().default(0),
  y: doublePrecision("y").notNull().default(0),
  width: doublePrecision("width").notNull().default(480),
  height: doublePrecision("height").notNull().default(360),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nodes = pgTable("nodes", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull().default("idea"),
  title: text("title").notNull().default(""),
  content: text("content").notNull().default(""),
  color: text("color").notNull().default("neutral"),
  x: doublePrecision("x").notNull().default(0),
  y: doublePrecision("y").notNull().default(0),
  width: doublePrecision("width").notNull().default(280),
  height: doublePrecision("height").notNull().default(190),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const connections = pgTable("connections", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  label: text("label").notNull().default(""),
  style: jsonb("style")
    .$type<{ dashed?: boolean; thickness?: number; directed?: boolean; color?: string }>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  nodeId: uuid("node_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // image | file | audio | link
  url: text("url").notNull(),
  name: text("name").notNull().default(""),
  mimeType: text("mime_type").notNull().default(""),
  size: integer("size").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
