import { db } from "@/db";
import { groups, nodes } from "@/db/schema";
import { serializeGroup } from "@/lib/serialize";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const EDITABLE_FIELDS = ["title", "color", "x", "y", "width", "height"] as const;

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

    const [row] = await db.update(groups).set(update).where(eq(groups.id, id)).returning();

    if (!row) {
      return Response.json({ error: "Group not found" }, { status: 404 });
    }

    return Response.json(serializeGroup(row));
  } catch (error) {
    console.error("PATCH /api/groups/[id] failed", error);
    return Response.json({ error: "Failed to update group" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;

    // Detach member nodes instead of deleting them — groups are organizational,
    // not containers that own data (spec §13).
    await db.update(nodes).set({ groupId: null }).where(eq(nodes.groupId, id));

    const [row] = await db.delete(groups).where(eq(groups.id, id)).returning();

    if (!row) {
      return Response.json({ error: "Group not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/groups/[id] failed", error);
    return Response.json({ error: "Failed to delete group" }, { status: 500 });
  }
}
