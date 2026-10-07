/** Comma-separated CIDRs/IPs for `BETTER_AUTH_TRUSTED_PROXIES` (reverse proxy / ALB). */
export function readTrustedProxies(): string[] | undefined {
  const raw = process.env.BETTER_AUTH_TRUSTED_PROXIES?.trim();
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}
