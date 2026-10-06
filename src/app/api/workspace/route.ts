import { db } from "@/db";
import { nodes, connections, groups, attachments } from "@/db/schema";
import {
  serializeNode,
  serializeConnection,
  serializeGroup,
  serializeAttachment,
} from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [nodeRows, connectionRows, groupRows, attachmentRows] = await Promise.all([
      db.select().from(nodes),
      db.select().from(connections),
      db.select().from(groups),
      db.select().from(attachments),
    ]);

    return Response.json({
      nodes: nodeRows.map(serializeNode),
      connections: connectionRows.map(serializeConnection),
      groups: groupRows.map(serializeGroup),
      attachments: attachmentRows.map(serializeAttachment),
    });
  } catch (error) {
    console.error("GET /api/workspace failed", error);
    return Response.json({ error: "Failed to load workspace" }, { status: 500 });
  }
}
