import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MAX_IMAGES_PER_POST,
  MAX_UPLOAD_BYTES,
} from "@/lib/config/upload-limits";

export { MAX_IMAGES_PER_POST, MAX_UPLOAD_BYTES };

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

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

const UPLOAD_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function uploadContentType(storageKey: string): string {
  const ext = storageKey.split(".").pop() ?? "jpg";
  return UPLOAD_MIME[ext] ?? "application/octet-stream";
}

export type PostUploadFile = {
  storageKey: string;
  filename: string;
  contentType: string;
  data: Buffer;
};

/** Файл поста с диска (`data/uploads`) — для отправки в Telegram без публичного URL. */
export async function readPostUploadFile(
  storageKey: string,
): Promise<PostUploadFile | null> {
  const filePath = resolveUploadPath(storageKey);
  if (!filePath) return null;
  try {
    const data = await readFile(filePath);
    return {
      storageKey,
      filename: storageKey,
      contentType: uploadContentType(storageKey),
      data,
    };
  } catch {
    return null;
  }
}
