import {
  releaseInFlightLock,
  tryAcquireInFlightLock,
} from "@/lib/bots/social-publish/in-flight-lock";
import { tryAcquireSendSlot } from "@/lib/bots/social-publish/rate-limit";
import type { SocialPublishChannel } from "@/lib/bots/social-publish/types";

/**
 * Lock и лимит до первого await. `prepare` может отменить отправку (уже в meta).
 * `send` вызывается только после успешного захвата слота лимита.
 */
export async function withSocialPublishGuard(
  channel: SocialPublishChannel,
  postId: string,
  prepare: () => Promise<boolean>,
  send: () => Promise<void>,
): Promise<void> {
  if (!tryAcquireInFlightLock(channel, postId)) return;
  try {
    if (!(await prepare())) return;
    if (!tryAcquireSendSlot(channel)) return;
    await send();
  } finally {
    releaseInFlightLock(channel, postId);
  }
}
