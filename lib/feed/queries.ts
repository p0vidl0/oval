import { and, desc, eq, gt, gte, inArray, type SQL } from "drizzle-orm";
import {
  DEFAULT_PAGE_SIZE,
  type PageRequest,
  paginate,
} from "@/lib/admin/pagination";
import { db } from "@/lib/db/client";
import { countRows } from "@/lib/db/count-rows";
import { feedPosts, trainingSessions } from "@/lib/db/schema";
import { isPostLive, livePostCondition } from "@/lib/feed/publication";
import type {
  FeedPostMeta,
  FeedPostStatus,
  FeedPostType,
} from "@/lib/feed/types";

export async function listPublishedFeedPosts(options?: {
  type?: FeedPostType;
  types?: FeedPostType[];
  limit?: number;
}) {
  const limit = options?.limit ?? 50;
  const conditions = [livePostCondition()];
  if (options?.types?.length) {
    conditions.push(inArray(feedPosts.type, options.types));
  } else if (options?.type) {
    conditions.push(eq(feedPosts.type, options.type));
  }
  return db
    .select()
    .from(feedPosts)
    .where(and(...conditions))
    .orderBy(
      desc(feedPosts.pinned),
      desc(feedPosts.publishedAt),
      desc(feedPosts.createdAt),
    )
    .limit(limit);
}

export async function getFeedPostById(id: string) {
  const rows = await db.select().from(feedPosts).where(eq(feedPosts.id, id));
  return rows[0] ?? null;
}

export async function getPublishedFeedPostById(id: string) {
  const post = await getFeedPostById(id);
  if (!post || !isPostLive(post)) return null;
  return post;
}

/** Фильтр списка публикаций в админке; `scheduled` — отложенные. */
export type AdminPostFilter = FeedPostStatus | "scheduled";

export async function listAllFeedPostsForAdmin(options?: {
  filter?: AdminPostFilter;
  request?: PageRequest;
}) {
  const now = new Date();
  const filter = options?.filter;
  const where: SQL | undefined =
    filter === "published"
      ? livePostCondition(now)
      : filter === "scheduled"
        ? and(eq(feedPosts.status, "published"), gt(feedPosts.publishedAt, now))
        : filter
          ? eq(feedPosts.status, filter)
          : undefined;
  return paginate(
    options?.request ?? { page: 1, size: DEFAULT_PAGE_SIZE },
    () => countRows(feedPosts, where),
    (limit, offset) =>
      db
        .select()
        .from(feedPosts)
        .where(where)
        .orderBy(desc(feedPosts.createdAt), desc(feedPosts.id))
        .limit(limit)
        .offset(offset),
  );
}

/** Тренировка, к которой относится пост (анонс, перенос, отмена). */
export async function getTrainingSessionForPost(post: {
  relatedSessionId: string | null;
}) {
  if (!post.relatedSessionId) return null;
  return getTrainingSessionById(post.relatedSessionId);
}

export async function getTrainingSessionById(id: string) {
  const rows = await db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.id, id));
  return rows[0] ?? null;
}

export async function listUpcomingScheduledSessions(limit = 8) {
  const now = new Date();
  return db
    .select({
      session: trainingSessions,
      post: feedPosts,
    })
    .from(trainingSessions)
    .innerJoin(
      feedPosts,
      and(
        eq(feedPosts.relatedSessionId, trainingSessions.id),
        eq(feedPosts.type, "training_announcement"),
      ),
    )
    .where(
      and(
        gte(trainingSessions.startsAt, now),
        eq(trainingSessions.status, "scheduled"),
        livePostCondition(now),
      ),
    )
    .orderBy(trainingSessions.startsAt)
    .limit(limit);
}

export async function getSessionsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(trainingSessions)
    .where(inArray(trainingSessions.id, [...new Set(ids)]));
}

export async function getAnnouncementForSession(sessionId: string) {
  const rows = await db
    .select()
    .from(feedPosts)
    .where(
      and(
        eq(feedPosts.relatedSessionId, sessionId),
        eq(feedPosts.type, "training_announcement"),
      ),
    );
  return rows[0] ?? null;
}

/** Все посты по тренировке (анонс, переносы, отмены), новые сверху. */
export async function listPostsForSession(sessionId: string) {
  return db
    .select()
    .from(feedPosts)
    .where(eq(feedPosts.relatedSessionId, sessionId))
    .orderBy(desc(feedPosts.createdAt));
}

export async function getFeedPostsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(feedPosts).where(inArray(feedPosts.id, ids));
}

/** Последний опубликованный перенос по каждой тренировке → прежнее время начала. */
export async function getPreviousStartByRescheduledSessions(
  sessionIds: string[],
) {
  if (sessionIds.length === 0) return new Map<string, string>();
  const rows = await db
    .select({
      relatedSessionId: feedPosts.relatedSessionId,
      meta: feedPosts.meta,
      publishedAt: feedPosts.publishedAt,
    })
    .from(feedPosts)
    .where(
      and(
        eq(feedPosts.type, "training_rescheduled"),
        livePostCondition(),
        inArray(feedPosts.relatedSessionId, sessionIds),
      ),
    )
    .orderBy(desc(feedPosts.publishedAt));

  const map = new Map<string, string>();
  for (const row of rows) {
    const sid = row.relatedSessionId;
    if (!sid || map.has(sid)) continue;
    const meta = (row.meta ?? {}) as FeedPostMeta;
    if (meta.previousStartsAt) {
      map.set(sid, meta.previousStartsAt);
    }
  }
  return map;
}

/** Видимые в ленте анонсы тренировок: sessionId → postId. */
export async function getLiveAnnouncementIdsBySession(sessionIds: string[]) {
  const map = new Map<string, string>();
  if (sessionIds.length === 0) return map;
  const rows = await db
    .select({ id: feedPosts.id, sessionId: feedPosts.relatedSessionId })
    .from(feedPosts)
    .where(
      and(
        eq(feedPosts.type, "training_announcement"),
        inArray(feedPosts.relatedSessionId, [...new Set(sessionIds)]),
        livePostCondition(),
      ),
    );
  for (const row of rows) {
    if (row.sessionId) map.set(row.sessionId, row.id);
  }
  return map;
}
