export function getVkClientId(): string | undefined {
  const id = process.env.VK_CLIENT_ID?.trim();
  return id || undefined;
}

export function getVkClientSecret(): string | undefined {
  const secret = process.env.VK_CLIENT_SECRET?.trim();
  return secret || undefined;
}

export function isVkConfigured(): boolean {
  return Boolean(getVkClientId() && getVkClientSecret());
}

/** Better Auth passes `baseURL` with `/api/auth`; bare site origin is also accepted. */
export function getVkRedirectUri(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const authBase = base.endsWith("/api/auth") ? base : `${base}/api/auth`;
  return `${authBase}/callback/vk`;
}
