import { tryPublishFeedPostToTelegramChannel } from "@/lib/bots/telegram/publish-feed-post";
import {
  failStaleSocialPublishClaims,
  listPendingSocialPublishJobs,
} from "@/lib/feed/social-publish-jobs";

export async function sweepPendingSocialPublishes(
  now = new Date(),
): Promise<void> {
  await failStaleSocialPublishClaims(now);
  const pending = await listPendingSocialPublishJobs(now);
  for (const job of pending) {
    await tryPublishFeedPostToTelegramChannel(job.postId);
  }
}
