import { db } from "@/db";
import { connections } from "@/db/schema";
import { serializeConnection } from "@/lib/serialize";
import { and, eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.sourceId || !body.targetId) {
      return Response.json({ error: "sourceId and targetId are required" }, { status: 400 });
    }

    if (body.sourceId === body.targetId) {
      return Response.json({ error: "Cannot connect a node to itself" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(connections)
      .where(
        or(
          and(eq(connections.sourceId, body.sourceId), eq(connections.targetId, body.targetId)),
          and(eq(connections.sourceId, body.targetId), eq(connections.targetId, body.sourceId)),
        ),
      );

    if (existing.length > 0) {
      return Response.json(serializeConnection(existing[0]), { status: 200 });
    }

    const [row] = await db
      .insert(connections)
      .values({
        ...(body.id ? { id: body.id } : {}),
        sourceId: body.sourceId,
        targetId: body.targetId,
        label: body.label ?? "",
        style: body.style ?? {},
      })
      .returning();

    return Response.json(serializeConnection(row), { status: 201 });
  } catch (error) {
    console.error("POST /api/connections failed", error);
    return Response.json({ error: "Failed to create connection" }, { status: 500 });
  }
}
