import { mkdir, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export async function saveUploadedFile(file: File, subdir: string) {
  const dir = path.join(UPLOAD_ROOT, subdir);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const ext = path.extname(file.name) || "";
  const safeName = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(dir, safeName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return {
    url: `/uploads/${subdir}/${safeName}`,
    size: buffer.byteLength,
  };
}

export async function deleteUploadedFile(url: string) {
  if (!url.startsWith("/uploads/")) return;
  const filePath = path.join(process.cwd(), "public", url);
  try {
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  } catch (error) {
    console.warn("Failed to remove uploaded file", url, error);
  }
}
