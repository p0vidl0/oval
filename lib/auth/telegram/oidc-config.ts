const DEFAULT_TELEGRAM_OIDC_ROOT = "https://oauth.telegram.org";

/** Базовый URL OIDC (reverse proxy). Без слэша в конце. Браузерный /auth не меняется. */
export function getTelegramOidcRoot(): string {
  const raw = process.env.TELEGRAM_OIDC_ROOT?.trim();
  if (!raw) return DEFAULT_TELEGRAM_OIDC_ROOT;
  return raw.replace(/\/$/, "");
}

export function getTelegramOidcTokenUrl(): string {
  return `${getTelegramOidcRoot()}/token`;
}

export function getTelegramOidcJwksUrl(): string {
  return `${getTelegramOidcRoot()}/.well-known/jwks.json`;
}

export function getTelegramOidcClientId(): string | undefined {
  const id =
    process.env.TELEGRAM_OIDC_CLIENT_ID?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.split(":")[0]?.trim();
  return id || undefined;
}

export function getTelegramOidcClientSecret(): string | undefined {
  const secret = process.env.TELEGRAM_OIDC_CLIENT_SECRET?.trim();
  return secret || undefined;
}

export function isTelegramOidcConfigured(): boolean {
  return Boolean(getTelegramOidcClientId() && getTelegramOidcClientSecret());
}

/** Better Auth passes `baseURL` with `/api/auth`; bare site origin is also accepted. */
export function getTelegramOidcRedirectUri(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const authBase = base.endsWith("/api/auth") ? base : `${base}/api/auth`;
  return `${authBase}/sign-in/telegram/oidc/callback`;
}
