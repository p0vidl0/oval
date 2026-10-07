import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { postImages } from "@/lib/db/schema";

export async function listImagesForPost(postId: string) {
  return db
    .select()
    .from(postImages)
    .where(and(eq(postImages.postId, postId), isNull(postImages.removedAt)))
    .orderBy(asc(postImages.sortOrder), asc(postImages.createdAt));
}

export async function listImagesForPosts(postIds: string[]) {
  if (postIds.length === 0) return [];
  return db
    .select()
    .from(postImages)
    .where(
      and(inArray(postImages.postId, postIds), isNull(postImages.removedAt)),
    )
    .orderBy(asc(postImages.sortOrder));
}
