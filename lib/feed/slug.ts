import { eq, like, or } from "drizzle-orm";
import type { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import type { FeedPostType } from "@/lib/feed/types";
import { formatDateInput } from "@/lib/format/datetime";

/** Публичный slug: `2026-10-31` или `2026-10-31-2`. */
export const POST_PUBLIC_SLUG_RE = /^\d{4}-\d{2}-\d{2}(-\d+)?$/;

export function isLikelyPostSlug(segment: string): boolean {
  return POST_PUBLIC_SLUG_RE.test(segment);
}

/** Календарный день клуба для slug (Asia/Omsk). */
export function postSlugDay(at: Date): string {
  return formatDateInput(at);
}

export function slugForOrdinal(day: string, ordinal: number): string {
  if (ordinal <= 1) return day;
  return `${day}-${ordinal}`;
}

/** Момент для дня slug: `published_at`, иначе `created_at`. */
export function instantForPostSlug(post: {
  publishedAt: Date | null;
  createdAt: Date;
}): Date {
  return post.publishedAt ?? post.createdAt;
}

/**
 * День slug новой записи. Анонс — календарный день тренировки;
 * остальные типы — момент публикации.
 */
export function instantForNewPostSlug(input: {
  type: FeedPostType;
  sessionStartsAt?: Date | null;
  publishedAt?: Date | null;
  now?: Date;
}): Date {
  if (input.type === "training_announcement" && input.sessionStartsAt) {
    return input.sessionStartsAt;
  }
  return input.publishedAt ?? input.now ?? new Date();
}

type SlugTx = Pick<typeof db, "select">;

/** Следующий свободный slug на день `at` (вызывать внутри транзакции вставки). */
export async function allocatePostSlug(tx: SlugTx, at: Date): Promise<string> {
  const day = postSlugDay(at);
  const rows = await tx
    .select({ slug: feedPosts.slug })
    .from(feedPosts)
    .where(or(eq(feedPosts.slug, day), like(feedPosts.slug, `${day}-%`)));

  const used = new Set(rows.map((r) => r.slug));
  let ordinal = 1;
  while (used.has(slugForOrdinal(day, ordinal))) {
    ordinal += 1;
  }
  return slugForOrdinal(day, ordinal);
}
