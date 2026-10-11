const MAX_REFERRER_LEN = 512;

/** Обрезает referrer; для внешних URL сохраняем origin + pathname без query. */
export function normalizeReferrer(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const compact = `${url.origin}${url.pathname}`;
    return compact.slice(0, MAX_REFERRER_LEN);
  } catch {
    return trimmed.slice(0, MAX_REFERRER_LEN);
  }
}

export function normalizePath(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || !trimmed.startsWith("/")) return null;
  return trimmed.slice(0, 512);
}
