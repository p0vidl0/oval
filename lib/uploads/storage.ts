import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Верхняя граница для любого типа (см. `maxImagesForPostType`). */
export const MAX_IMAGES_PER_POST = 10;

export function uploadPublicUrl(storageKey: string): string {
  return `/uploads/${storageKey}`;
}

export async function savePostImage(
  file: File,
): Promise<{ storageKey: string } | { error: string }> {
  if (!ALLOWED.has(file.type)) {
    return { error: "Допустимы JPEG, PNG и WebP" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "Файл больше 5 МБ" };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const storageKey = `${hash}.${ext}`;
  const dir = path.join(UPLOAD_ROOT);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storageKey), buf);
  return { storageKey };
}

export function resolveUploadPath(storageKey: string): string | null {
  if (!/^[a-f0-9]{16}\.(jpg|png|webp)$/.test(storageKey)) {
    return null;
  }
  return path.join(UPLOAD_ROOT, storageKey);
}
