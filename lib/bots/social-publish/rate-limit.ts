import type { SocialPublishChannel } from "@/lib/bots/social-publish/types";

const WINDOW_MS = 60 * 60 * 1000;
export const SOCIAL_PUBLISH_MAX_PER_HOUR = 10;

const GLOBAL_KEY = "__ovalSocialPublishRateLimit";

type RateLimitGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: Map<SocialPublishChannel, number[]>;
};

/** На `globalThis`: instrumentation и server actions — разные бандлы. */
function bucketsMap(): Map<SocialPublishChannel, number[]> {
  const g = globalThis as RateLimitGlobal;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map();
  return g[GLOBAL_KEY];
}

/** Слот под старт вызова API (до await). */
export function tryAcquireSendSlot(
  channel: SocialPublishChannel,
  now = Date.now(),
): boolean {
  const buckets = bucketsMap();
  const cutoff = now - WINDOW_MS;
  const recent = (buckets.get(channel) ?? []).filter((t) => t > cutoff);
  if (recent.length >= SOCIAL_PUBLISH_MAX_PER_HOUR) {
    buckets.set(channel, recent);
    return false;
  }
  recent.push(now);
  buckets.set(channel, recent);
  return true;
}

/** Только для тестов. */
export function resetSocialPublishRateLimitsForTests(): void {
  bucketsMap().clear();
}
