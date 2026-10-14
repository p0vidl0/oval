import type { SocialPublishChannel } from "@/lib/bots/social-publish/types";

const locks = new Set<string>();

function lockKey(channel: SocialPublishChannel, postId: string): string {
  return `${channel}:${postId}`;
}

export function tryAcquireInFlightLock(
  channel: SocialPublishChannel,
  postId: string,
): boolean {
  const key = lockKey(channel, postId);
  if (locks.has(key)) return false;
  locks.add(key);
  return true;
}

export function releaseInFlightLock(
  channel: SocialPublishChannel,
  postId: string,
): void {
  locks.delete(lockKey(channel, postId));
}

/** Только для тестов. */
export function resetInFlightLocksForTests(): void {
  locks.clear();
}
