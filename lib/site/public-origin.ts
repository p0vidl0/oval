/** Публичный origin сайта (канонический URL без trailing slash). */
export function getPublicSiteOrigin(): string {
  const raw = process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "");
  return raw ?? "";
}

export function getSiteMetadataBase(): URL | undefined {
  const origin = getPublicSiteOrigin();
  if (!origin) return undefined;
  try {
    return new URL(origin);
  } catch {
    return undefined;
  }
}

export function absoluteSiteUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const origin = getPublicSiteOrigin();
  return origin ? `${origin}${path}` : path;
}

const DEFAULT_META_DESCRIPTION = "Вечерние тренировки на велотреке в Омске";

/** Короткий текст для meta description / Open Graph. */
export function metaDescriptionFromBody(
  body: string,
  fallback = DEFAULT_META_DESCRIPTION,
): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).trimEnd()}…`;
}

export const siteDefaultDescription = DEFAULT_META_DESCRIPTION;
export const siteName = "Ночная лига";
