import type { FeedPostType } from "@/lib/feed/types";

/** Канонический путь публичной страницы материала. */
export function postPath(
  slug: string,
  type: FeedPostType,
): `/sessions/${string}` | `/news/${string}` {
  if (type === "training_announcement") return `/sessions/${slug}`;
  return `/news/${slug}`;
}

/** Старый корневой URL до префиксов `/sessions` и `/news`. */
export function legacyRootPostPath(slug: string): `/${string}` {
  return `/${slug}`;
}

/** Публичная ссылка на пост (ВК и fallback для Telegram без Mini App). */
export function publicFeedPostUrl(slug: string, type: FeedPostType): string {
  const path = postPath(slug, type);
  const raw = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "");
  return raw ? `${raw}${path}` : path;
}

/** @deprecated Используйте publicFeedPostUrl(slug, type). Оставлено для редиректа по id. */
export function legacyFeedPostPath(postId: string): `/feed/${string}` {
  return `/feed/${postId}`;
}
