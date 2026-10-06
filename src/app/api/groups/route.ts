import { db } from "@/db";
import { groups } from "@/db/schema";
import { serializeGroup } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const [row] = await db
      .insert(groups)
      .values({
        ...(body.id ? { id: body.id } : {}),
        title: body.title ?? "Untitled Group",
        color: body.color ?? "neutral",
        x: body.x ?? 0,
        y: body.y ?? 0,
        width: body.width ?? 480,
        height: body.height ?? 360,
      })
      .returning();

    return Response.json(serializeGroup(row), { status: 201 });
  } catch (error) {
    console.error("POST /api/groups failed", error);
    return Response.json({ error: "Failed to create group" }, { status: 500 });
  }
}
