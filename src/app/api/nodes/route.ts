import { db } from "@/db";
import { nodes } from "@/db/schema";
import { serializeNode } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const [row] = await db
      .insert(nodes)
      .values({
        ...(body.id ? { id: body.id } : {}),
        type: body.type ?? "idea",
        title: body.title ?? "",
        content: body.content ?? "",
        color: body.color ?? "neutral",
        x: body.x ?? 0,
        y: body.y ?? 0,
        width: body.width ?? 280,
        height: body.height ?? 190,
        groupId: body.groupId ?? null,
        metadata: body.metadata ?? {},
      })
      .returning();

    return Response.json(serializeNode(row), { status: 201 });
  } catch (error) {
    console.error("POST /api/nodes failed", error);
    return Response.json({ error: "Failed to create node" }, { status: 500 });
  }
}
