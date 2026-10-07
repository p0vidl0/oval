import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { postImages } from "@/lib/db/schema";
import { MAX_IMAGES_PER_POST, savePostImage } from "@/lib/uploads/storage";

export async function removePostImages(postId: string, imageIds: string[]) {
  const ids = [...new Set(imageIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return;
  const rows = await db
    .select({ id: postImages.id })
    .from(postImages)
    .where(
      and(
        eq(postImages.postId, postId),
        inArray(postImages.id, ids),
        isNull(postImages.removedAt),
      ),
    );
  if (rows.length !== ids.length) {
    throw new Error("Некорректный список фото для удаления");
  }
  // Фото снимаем с поста, строку и файл не удаляем.
  await db
    .update(postImages)
    .set({ removedAt: new Date() })
    .where(inArray(postImages.id, ids));
}

export async function syncImagesFromForm(
  postId: string,
  formData: FormData,
  defaultAlt: string,
  maxImages: number,
) {
  const removeIds = formData
    .getAll("remove_image_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
  await removePostImages(postId, removeIds);
  await appendImagesFromForm(postId, formData, defaultAlt, maxImages);
}

export async function appendImagesFromForm(
  postId: string,
  formData: FormData,
  defaultAlt: string,
  maxImages: number,
) {
  const limit = Math.min(maxImages, MAX_IMAGES_PER_POST);
  const existing = await db
    .select()
    .from(postImages)
    .where(and(eq(postImages.postId, postId), isNull(postImages.removedAt)));
  const files = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return;
  if (existing.length + files.length > limit) {
    throw new Error(
      limit === 1
        ? "У анонса может быть только одно фото"
        : `Не больше ${limit} фото на публикацию`,
    );
  }
  let order = existing.length;
  for (const file of files) {
    const saved = await savePostImage(file);
    if ("error" in saved) throw new Error(saved.error);
    await db.insert(postImages).values({
      id: crypto.randomUUID(),
      postId,
      storageKey: saved.storageKey,
      alt: defaultAlt,
      sortOrder: order++,
    });
  }
}
