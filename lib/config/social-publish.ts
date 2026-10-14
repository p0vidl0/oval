function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function readSocialPublishMaxRetries(): number {
  const n = readIntEnv("SOCIAL_PUBLISH_MAX_RETRIES", 3);
  return n > 0 ? n : 3;
}
