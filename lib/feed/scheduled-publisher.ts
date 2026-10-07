/**
 * Выпуск отложенных публикаций. Видимость в ленте от таймера не зависит
 * (`livePostCondition` сравнивает `published_at` с текущим временем); таймер
 * только оповещает открытые ленты (SSE) и применяет закрепление в момент выхода.
 */
import { and, eq, gt, lte } from "drizzle-orm";
import { applyPinned } from "@/lib/admin/post-pinning";
import { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import { publishFeedEvent } from "@/lib/realtime/feed-event-bus";

const INTERVAL_MS = 30_000;
const GLOBAL_KEY = "__ovalScheduledPublisher";

/** Посты, у которых время публикации наступило в интервале (from, to]. */
export async function releaseDuePosts(from: Date, to: Date) {
  const due = await db
    .select({
      id: feedPosts.id,
      pinned: feedPosts.pinned,
      relatedSessionId: feedPosts.relatedSessionId,
    })
    .from(feedPosts)
    .where(
      and(
        eq(feedPosts.status, "published"),
        gt(feedPosts.publishedAt, from),
        lte(feedPosts.publishedAt, to),
      ),
    );

  for (const post of due) {
    if (post.pinned) await applyPinned(db, post.id, true);
    publishFeedEvent({ type: "feed.post_published", postId: post.id });
    if (post.relatedSessionId) {
      publishFeedEvent({
        type: "session.changed",
        sessionId: post.relatedSessionId,
      });
    }
  }
  return due.map((p) => p.id);
}

/** Запускается один раз на процесс (из `instrumentation.ts`). */
export function startScheduledPublisher() {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: boolean };
  if (g[GLOBAL_KEY]) return;
  g[GLOBAL_KEY] = true;

  let lastCheck = new Date();
  const timer = setInterval(async () => {
    const now = new Date();
    try {
      await releaseDuePosts(lastCheck, now);
      lastCheck = now;
    } catch (error) {
      console.error("[scheduled-publisher]", error);
    }
  }, INTERVAL_MS);
  timer.unref?.();
}
