import { db } from "@/db";
import { attachments } from "@/db/schema";
import { deleteUploadedFile } from "@/lib/storage";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [row] = await db.delete(attachments).where(eq(attachments.id, id)).returning();

    if (!row) {
      return Response.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (row.kind !== "link") {
      await deleteUploadedFile(row.url);
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/attachments/[id] failed", error);
    return Response.json({ error: "Failed to delete attachment" }, { status: 500 });
  }
}
