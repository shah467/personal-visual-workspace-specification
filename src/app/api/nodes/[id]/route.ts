import { db } from "@/db";
import { nodes, attachments } from "@/db/schema";
import { serializeNode } from "@/lib/serialize";
import { deleteUploadedFile } from "@/lib/storage";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const EDITABLE_FIELDS = [
  "type",
  "title",
  "content",
  "color",
  "x",
  "y",
  "width",
  "height",
  "groupId",
  "metadata",
] as const;

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const update: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        update[field] = body[field];
      }
    }

    const [row] = await db.update(nodes).set(update).where(eq(nodes.id, id)).returning();

    if (!row) {
      return Response.json({ error: "Node not found" }, { status: 404 });
    }

    return Response.json(serializeNode(row));
  } catch (error) {
    console.error("PATCH /api/nodes/[id] failed", error);
    return Response.json({ error: "Failed to update node" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;

    const existingAttachments = await db
      .select()
      .from(attachments)
      .where(eq(attachments.nodeId, id));

    await Promise.all(existingAttachments.map((a) => deleteUploadedFile(a.url)));

    const [row] = await db.delete(nodes).where(eq(nodes.id, id)).returning();

    if (!row) {
      return Response.json({ error: "Node not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/nodes/[id] failed", error);
    return Response.json({ error: "Failed to delete node" }, { status: 500 });
  }
}
