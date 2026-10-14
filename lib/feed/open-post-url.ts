/** Публичная ссылка на пост (ВК и fallback для Telegram без Mini App). */
export function publicFeedPostUrl(postId: string): string {
  const raw = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "");
  return raw ? `${raw}/feed/${postId}` : `/feed/${postId}`;
}
