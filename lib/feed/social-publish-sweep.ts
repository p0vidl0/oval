import { tryPublishFeedPostToTelegramChannel } from "@/lib/bots/telegram/publish-feed-post";
import { listPendingSocialPublishJobs } from "@/lib/feed/social-publish-jobs";

export async function sweepPendingSocialPublishes(
  now = new Date(),
): Promise<void> {
  const pending = await listPendingSocialPublishJobs(now);
  for (const job of pending) {
    await tryPublishFeedPostToTelegramChannel(job.postId);
  }
}
