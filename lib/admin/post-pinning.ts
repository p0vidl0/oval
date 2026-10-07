import { eq, ne } from "drizzle-orm";
import type { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import { isPostScheduled } from "@/lib/feed/publication";
import type { FeedPostStatus } from "@/lib/feed/types";

/** Закреплённым может быть только один пост в ленте. */
export async function applyPinned(
  tx: Pick<typeof db, "update">,
  postId: string,
  pinned: boolean,
) {
  if (!pinned) {
    await tx
      .update(feedPosts)
      .set({ pinned: false })
      .where(eq(feedPosts.id, postId));
    return;
  }
  await tx
    .update(feedPosts)
    .set({ pinned: false })
    .where(ne(feedPosts.id, postId));
  await tx
    .update(feedPosts)
    .set({ pinned: true })
    .where(eq(feedPosts.id, postId));
}

/**
 * Закрепление с учётом отложенной публикации: у отложенного поста флаг
 * сохраняется, но текущий закреплённый пост открепляется только в момент
 * выхода (см. `lib/feed/scheduled-publisher.ts`).
 */
export async function savePinnedForState(
  tx: Pick<typeof db, "update">,
  postId: string,
  pinned: boolean,
  state: { status: FeedPostStatus; publishedAt: Date | null },
) {
  if (pinned && isPostScheduled(state)) return;
  await applyPinned(tx, postId, pinned);
}
