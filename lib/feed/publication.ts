/**
 * Видимость поста в ленте. Отложенная публикация — `status = published`
 * с `published_at` в будущем: пост появляется сам, когда наступает время.
 */
import { and, eq, lte, type SQL } from "drizzle-orm";
import { feedPosts } from "@/lib/db/schema";
import type { FeedPostStatus } from "@/lib/feed/types";

type PublicationState = {
  status: FeedPostStatus;
  publishedAt: Date | null;
};

/** Пост виден в ленте прямо сейчас. */
export function isPostLive(post: PublicationState, now = new Date()): boolean {
  return (
    post.status === "published" &&
    post.publishedAt !== null &&
    post.publishedAt.getTime() <= now.getTime()
  );
}

/** Опубликован, но время публикации ещё не наступило. */
export function isPostScheduled(
  post: PublicationState,
  now = new Date(),
): boolean {
  return (
    post.status === "published" &&
    post.publishedAt !== null &&
    post.publishedAt.getTime() > now.getTime()
  );
}

/** SQL-условие «пост виден в ленте». */
export function livePostCondition(now = new Date()): SQL {
  return and(
    eq(feedPosts.status, "published"),
    lte(feedPosts.publishedAt, now),
  ) as SQL;
}
