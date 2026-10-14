import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";

export const FEED_POST_PATH_RE = /^\/feed\/([^/]+)$/;

const POST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const STATIC_ANALYTICS_PATH_LABELS: Readonly<Record<string, string>> = {
  "/": "Главная",
  "/feed": "Лента",
  "/login": "Вход",
  "/login/telegram/complete": "Telegram — вход",
  "/privacy": "Политика конфиденциальности",
};

export function feedPostIdFromAnalyticsPath(path: string): string | null {
  const match = FEED_POST_PATH_RE.exec(path);
  const id = match?.[1];
  if (!id || !POST_ID_RE.test(id)) return null;
  return id;
}

/** Чистая функция для unit-тестов и сборки подписей после batch-load. */
export function labelForAnalyticsPath(
  path: string,
  postTitles: ReadonlyMap<string, string>,
  staticLabels: Readonly<Record<string, string>> = STATIC_ANALYTICS_PATH_LABELS,
): string {
  const staticLabel = staticLabels[path];
  if (staticLabel) return staticLabel;

  const postId = feedPostIdFromAnalyticsPath(path);
  if (postId) {
    const title = postTitles.get(postId);
    if (title) return title;
  }

  return path;
}

export async function resolveAnalyticsPathLabels(
  paths: string[],
): Promise<Map<string, string>> {
  const postIds = new Set<string>();
  for (const path of paths) {
    const id = feedPostIdFromAnalyticsPath(path);
    if (id) postIds.add(id);
  }

  const postTitles = new Map<string, string>();
  if (postIds.size > 0) {
    const ids = [...postIds];
    const rows = await db
      .select({ id: feedPosts.id, title: feedPosts.title })
      .from(feedPosts)
      .where(inArray(feedPosts.id, ids));
    for (const row of rows) {
      postTitles.set(row.id, row.title);
    }
  }

  const labels = new Map<string, string>();
  for (const path of paths) {
    labels.set(path, labelForAnalyticsPath(path, postTitles));
  }
  return labels;
}
