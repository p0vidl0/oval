import { and, desc, eq } from "drizzle-orm";
import type { SocialPublishChannel } from "@/lib/bots/social-publish/types";
import { isTelegramChannelPublishConfigured } from "@/lib/bots/telegram/channel-config";
import { readSocialPublishMaxRetries } from "@/lib/config/social-publish";
import { db } from "@/lib/db/client";
import { feedPostSocialPublishes, feedPosts } from "@/lib/db/schema";
import { livePostCondition } from "@/lib/feed/publication";
import { getFeedPostById } from "@/lib/feed/queries";

const LAST_ERROR_MAX = 1000;

export type SocialPublishJobRow = typeof feedPostSocialPublishes.$inferSelect;

export type PendingSocialPublishJob = {
  jobId: string;
  postId: string;
  channel: SocialPublishChannel;
};

function truncateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length <= LAST_ERROR_MAX
    ? message
    : `${message.slice(0, LAST_ERROR_MAX - 1)}…`;
}

export function nextFailureAfterAttempt(
  attemptCount: number,
  maxRetries: number,
): { attemptCount: number; status: "pending" | "failed" } {
  const next = attemptCount + 1;
  return {
    attemptCount: next,
    status: next >= maxRetries ? "failed" : "pending",
  };
}

async function insertJobIfMissing(
  postId: string,
  channel: SocialPublishChannel,
): Promise<void> {
  await db
    .insert(feedPostSocialPublishes)
    .values({
      id: crypto.randomUUID(),
      feedPostId: postId,
      channel,
      status: "pending",
      attemptCount: 0,
    })
    .onConflictDoNothing({
      target: [
        feedPostSocialPublishes.feedPostId,
        feedPostSocialPublishes.channel,
      ],
    });
}

/** Строки outbox для поста с флагами (без сброса sent/failed). */
export async function ensureSocialPublishJobs(postId: string): Promise<void> {
  const post = await getFeedPostById(postId);
  if (!post) return;

  if (post.publishToTelegram && isTelegramChannelPublishConfigured()) {
    await insertJobIfMissing(postId, "telegram");
  }
}

export async function getSocialPublishJob(
  postId: string,
  channel: SocialPublishChannel,
): Promise<SocialPublishJobRow | undefined> {
  const rows = await db
    .select()
    .from(feedPostSocialPublishes)
    .where(
      and(
        eq(feedPostSocialPublishes.feedPostId, postId),
        eq(feedPostSocialPublishes.channel, channel),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function listPendingSocialPublishJobs(
  now = new Date(),
): Promise<PendingSocialPublishJob[]> {
  return db
    .select({
      jobId: feedPostSocialPublishes.id,
      postId: feedPostSocialPublishes.feedPostId,
      channel: feedPostSocialPublishes.channel,
    })
    .from(feedPostSocialPublishes)
    .innerJoin(feedPosts, eq(feedPostSocialPublishes.feedPostId, feedPosts.id))
    .where(
      and(
        eq(feedPostSocialPublishes.status, "pending"),
        eq(feedPostSocialPublishes.channel, "telegram"),
        eq(feedPosts.publishToTelegram, true),
        livePostCondition(now),
      ),
    )
    .orderBy(desc(feedPosts.publishedAt));
}

export async function listPendingSocialPublishJobsForPost(
  postId: string,
  now = new Date(),
): Promise<PendingSocialPublishJob[]> {
  return db
    .select({
      jobId: feedPostSocialPublishes.id,
      postId: feedPostSocialPublishes.feedPostId,
      channel: feedPostSocialPublishes.channel,
    })
    .from(feedPostSocialPublishes)
    .innerJoin(feedPosts, eq(feedPostSocialPublishes.feedPostId, feedPosts.id))
    .where(
      and(
        eq(feedPostSocialPublishes.feedPostId, postId),
        eq(feedPostSocialPublishes.status, "pending"),
        eq(feedPostSocialPublishes.channel, "telegram"),
        eq(feedPosts.publishToTelegram, true),
        livePostCondition(now),
      ),
    );
}

export function jobReadyToSend(
  job: SocialPublishJobRow,
  maxRetries = readSocialPublishMaxRetries(),
): boolean {
  return job.status === "pending" && job.attemptCount < maxRetries;
}

export async function markSocialPublishSent(
  jobId: string,
  externalId: string | number,
): Promise<void> {
  await db
    .update(feedPostSocialPublishes)
    .set({
      status: "sent",
      externalId: String(externalId),
      lastError: null,
    })
    .where(eq(feedPostSocialPublishes.id, jobId));
}

export async function recordSocialPublishFailure(
  jobId: string,
  error: unknown,
): Promise<void> {
  const rows = await db
    .select()
    .from(feedPostSocialPublishes)
    .where(eq(feedPostSocialPublishes.id, jobId))
    .limit(1);
  const job = rows[0];
  if (!job || job.status !== "pending") return;

  const maxRetries = readSocialPublishMaxRetries();
  const next = nextFailureAfterAttempt(job.attemptCount, maxRetries);
  await db
    .update(feedPostSocialPublishes)
    .set({
      attemptCount: next.attemptCount,
      status: next.status,
      lastError: truncateError(error),
    })
    .where(eq(feedPostSocialPublishes.id, jobId));
}
