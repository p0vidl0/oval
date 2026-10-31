/** Канонический путь публичной страницы материала. */
export function postPath(slug: string): `/${string}` {
  return `/${slug}`;
}

/** Публичная ссылка на пост (ВК и fallback для Telegram без Mini App). */
export function publicFeedPostUrl(slug: string): string {
  const path = postPath(slug);
  const raw = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "");
  return raw ? `${raw}${path}` : path;
}

/** @deprecated Используйте publicFeedPostUrl(slug). Оставлено для редиректа по id. */
export function legacyFeedPostPath(postId: string): `/feed/${string}` {
  return `/feed/${postId}`;
}
