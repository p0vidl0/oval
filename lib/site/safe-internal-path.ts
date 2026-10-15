const INTERNAL_BASE = "https://internal.invalid";

/**
 * Путь только на этот сайт. `//host` и абсолютный URL становятся fallback:
 * их нельзя отдавать в redirect и router.push.
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/cabinet",
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed.charCodeAt(i) < 32) return fallback;
  }

  try {
    const url = new URL(trimmed, INTERNAL_BASE);
    if (url.origin !== INTERNAL_BASE) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

/** Как safeInternalPath, но пустой ввод остаётся отсутствующим путём. */
export function optionalSafeInternalPath(
  value: string | null | undefined,
): string | undefined {
  if (!value?.trim()) return undefined;
  const safe = safeInternalPath(value, "");
  return safe.startsWith("/") ? safe : undefined;
}
