import { db } from "@/db";
import { attachments } from "@/db/schema";
import { serializeAttachment } from "@/lib/serialize";
import { saveUploadedFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const nodeId = formData.get("nodeId");
      const kind = (formData.get("kind") as string) ?? "file";

      if (!(file instanceof File) || typeof nodeId !== "string") {
        return Response.json({ error: "file and nodeId are required" }, { status: 400 });
      }

      const { url, size } = await saveUploadedFile(file, nodeId);

      const [row] = await db
        .insert(attachments)
        .values({
          nodeId,
          kind,
          url,
          name: file.name,
          mimeType: file.type,
          size,
          metadata: {},
        })
        .returning();

      return Response.json(serializeAttachment(row), { status: 201 });
    }

    // JSON body: used for link attachments (no file upload needed).
    const body = await request.json();
    if (!body.nodeId || !body.url) {
      return Response.json({ error: "nodeId and url are required" }, { status: 400 });
    }

    const [row] = await db
      .insert(attachments)
      .values({
        nodeId: body.nodeId,
        kind: body.kind ?? "link",
        url: body.url,
        name: body.name ?? body.url,
        mimeType: "",
        size: 0,
        metadata: body.metadata ?? {},
      })
      .returning();

    return Response.json(serializeAttachment(row), { status: 201 });
  } catch (error) {
    console.error("POST /api/attachments failed", error);
    return Response.json({ error: "Failed to create attachment" }, { status: 500 });
  }
}
