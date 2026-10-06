import { db } from "@/db";
import { connections } from "@/db/schema";
import { serializeConnection } from "@/lib/serialize";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const update: Record<string, unknown> = {};
    if ("label" in body) update.label = body.label;
    if ("style" in body) update.style = body.style;

    const [row] = await db
      .update(connections)
      .set(update)
      .where(eq(connections.id, id))
      .returning();

    if (!row) {
      return Response.json({ error: "Connection not found" }, { status: 404 });
    }

    return Response.json(serializeConnection(row));
  } catch (error) {
    console.error("PATCH /api/connections/[id] failed", error);
    return Response.json({ error: "Failed to update connection" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [row] = await db.delete(connections).where(eq(connections.id, id)).returning();

    if (!row) {
      return Response.json({ error: "Connection not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/connections/[id] failed", error);
    return Response.json({ error: "Failed to delete connection" }, { status: 500 });
  }
}
