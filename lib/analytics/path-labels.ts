import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import { POST_PUBLIC_SLUG_RE } from "@/lib/feed/slug";

export const FEED_POST_PATH_RE = /^\/feed\/([^/]+)$/;

const POST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROOT_POST_SLUG_RE = /^\/(\d{4}-\d{2}-\d{2}(?:-\d+)?)$/;

export const STATIC_ANALYTICS_PATH_LABELS: Readonly<Record<string, string>> = {
  "/": "Главная",
  "/feed": "Лента",
  "/login": "Вход",
  "/login/telegram/complete": "Telegram — вход",
  "/privacy": "Политика конфиденциальности",
};

export function feedPostIdFromAnalyticsPath(path: string): string | null {
  const legacy = FEED_POST_PATH_RE.exec(path);
  const legacyId = legacy?.[1];
  if (legacyId && POST_ID_RE.test(legacyId)) return legacyId;
  return null;
}

export function feedPostSlugFromAnalyticsPath(path: string): string | null {
  const root = ROOT_POST_SLUG_RE.exec(path);
  const slug = root?.[1];
  if (slug && POST_PUBLIC_SLUG_RE.test(slug)) return slug;
  const legacy = FEED_POST_PATH_RE.exec(path);
  const legacySlug = legacy?.[1];
  if (legacySlug && POST_PUBLIC_SLUG_RE.test(legacySlug)) return legacySlug;
  return null;
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

  const slug = feedPostSlugFromAnalyticsPath(path);
  if (slug) {
    const title = postTitles.get(`slug:${slug}`);
    if (title) return title;
  }

  return path;
}

export async function resolveAnalyticsPathLabels(
  paths: string[],
): Promise<Map<string, string>> {
  const postIds = new Set<string>();
  const slugs = new Set<string>();
  for (const path of paths) {
    const id = feedPostIdFromAnalyticsPath(path);
    if (id) postIds.add(id);
    const slug = feedPostSlugFromAnalyticsPath(path);
    if (slug) slugs.add(slug);
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
  if (slugs.size > 0) {
    const slugList = [...slugs];
    const rows = await db
      .select({ slug: feedPosts.slug, title: feedPosts.title })
      .from(feedPosts)
      .where(inArray(feedPosts.slug, slugList));
    for (const row of rows) {
      postTitles.set(`slug:${row.slug}`, row.title);
    }
  }

  const labels = new Map<string, string>();
  for (const path of paths) {
    labels.set(path, labelForAnalyticsPath(path, postTitles));
  }
  return labels;
}
