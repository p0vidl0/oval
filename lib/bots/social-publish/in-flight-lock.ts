import type { SocialPublishChannel } from "@/lib/bots/social-publish/types";

const GLOBAL_KEY = "__ovalSocialPublishInFlight";

type LockGlobal = typeof globalThis & {
  [GLOBAL_KEY]?: Set<string>;
};

function locks(): Set<string> {
  const g = globalThis as LockGlobal;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Set();
  return g[GLOBAL_KEY];
}

function lockKey(channel: SocialPublishChannel, postId: string): string {
  return `${channel}:${postId}`;
}

/**
 * Быстрый замок внутри одного realm.
 * Set на модуле не общий: instrumentation и server actions — разные бандлы.
 * Между процессами публикацию держит claim в `feed_post_social_publishes`.
 */
export function tryAcquireInFlightLock(
  channel: SocialPublishChannel,
  postId: string,
): boolean {
  const key = lockKey(channel, postId);
  const held = locks();
  if (held.has(key)) return false;
  held.add(key);
  return true;
}

export function releaseInFlightLock(
  channel: SocialPublishChannel,
  postId: string,
): void {
  locks().delete(lockKey(channel, postId));
}

/** Только для тестов. */
export function resetInFlightLocksForTests(): void {
  locks().clear();
}
