import type { InferInsertModel } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import { allocatePostSlug } from "@/lib/feed/slug";

type FeedPostInsert = Omit<InferInsertModel<typeof feedPosts>, "slug">;

export async function insertFeedPost(row: FeedPostInsert): Promise<string> {
  const at = row.publishedAt ?? row.createdAt ?? new Date();
  let slug = "";
  await db.transaction(async (tx) => {
    slug = await allocatePostSlug(tx, at);
    await tx.insert(feedPosts).values({ ...row, slug });
  });
  return slug;
}
