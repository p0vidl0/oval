import { readFile } from "node:fs/promises";
import { resolveUploadPath } from "@/lib/uploads/storage";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  const storageKey = segments.join("/");
  const filePath = resolveUploadPath(storageKey);
  if (!filePath) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const data = await readFile(filePath);
    const ext = storageKey.split(".").pop() ?? "jpg";
    return new Response(data, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
