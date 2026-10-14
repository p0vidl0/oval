import { after } from "next/server";
import type { PublicationState } from "@/lib/admin/publication-form";
import { tryPublishFeedPostToTelegramChannel } from "@/lib/bots/telegram/publish-feed-post";
import { isPostLive } from "@/lib/feed/publication";
import { listPendingSocialPublishJobsForPost } from "@/lib/feed/social-publish-jobs";

async function publishPendingJobsForPost(postId: string): Promise<void> {
  const jobs = await listPendingSocialPublishJobsForPost(postId);
  await Promise.all(
    jobs.map((job) => tryPublishFeedPostToTelegramChannel(job.postId)),
  );
}

/** Отправка в Telegram после ответа, если пост уже в ленте. */
export function scheduleSocialPublishAfter(
  postId: string,
  state: PublicationState,
): void {
  if (!isPostLive(state)) return;
  after(() => publishPendingJobsForPost(postId));
}
