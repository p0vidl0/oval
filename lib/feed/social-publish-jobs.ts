import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { SocialPublishChannel } from "@/lib/bots/social-publish/types";
import { isTelegramChannelPublishConfigured } from "@/lib/bots/telegram/channel-config";
import { readSocialPublishMaxRetries } from "@/lib/config/social-publish";
import { db } from "@/lib/db/client";
import { feedPostSocialPublishes, feedPosts } from "@/lib/db/schema";
import { livePostCondition } from "@/lib/feed/publication";
import { getFeedPostById } from "@/lib/feed/queries";

const LAST_ERROR_MAX = 1000;

/** Дольше этого `sending` без heartbeat считается брошенным. */
export const SOCIAL_PUBLISH_CLAIM_STALE_MS = 2 * 60 * 1000;

export type SocialPublishClaim = {
  jobId: string;
  /** Владелец claim. Чужой `recordSocialPublishFailure` по нему не попадёт. */
  token: string;
};

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

/**
 * Один победитель: `pending` → `sending` до вызова Telegram.
 * Второй параллельный вызов (after + догон, другой процесс) получает null.
 * `external_id` на время отправки — токен владельца, после успеха — message id.
 */
export async function claimSocialPublishJob(
  jobId: string,
): Promise<SocialPublishClaim | null> {
  const claim: SocialPublishClaim = { jobId, token: crypto.randomUUID() };
  const rows = await db
    .update(feedPostSocialPublishes)
    .set({
      status: "sending",
      externalId: claim.token,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(feedPostSocialPublishes.id, jobId),
        eq(feedPostSocialPublishes.status, "pending"),
      ),
    )
    .returning({ id: feedPostSocialPublishes.id });
  return rows.length === 1 ? claim : null;
}

/** Продлевает живой claim, чтобы догон не забрал его во время долгого upload. */
export async function touchSocialPublishClaim(
  claim: SocialPublishClaim,
): Promise<boolean> {
  const rows = await db
    .update(feedPostSocialPublishes)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(feedPostSocialPublishes.id, claim.jobId),
        eq(feedPostSocialPublishes.status, "sending"),
        eq(feedPostSocialPublishes.externalId, claim.token),
      ),
    )
    .returning({ id: feedPostSocialPublishes.id });
  return rows.length === 1;
}

export const SOCIAL_PUBLISH_STALE_CLAIM_ERROR =
  "Отправка прервана, результат неизвестен — проверьте канал";

/**
 * Брошенный `sending` → `failed`, не в очередь.
 * Процесс мог упасть уже после ответа Telegram; повтор дал бы дубль.
 * Токен владельца остаётся: если процесс жив и Telegram всё же ответит,
 * `markSocialPublishSent` переведёт строку в `sent`.
 * Свежий heartbeat не трогает.
 */
export async function failStaleSocialPublishClaims(
  now = new Date(),
): Promise<void> {
  const cutoff = new Date(now.getTime() - SOCIAL_PUBLISH_CLAIM_STALE_MS);
  await db
    .update(feedPostSocialPublishes)
    .set({
      status: "failed",
      lastError: SOCIAL_PUBLISH_STALE_CLAIM_ERROR,
    })
    .where(
      and(
        eq(feedPostSocialPublishes.status, "sending"),
        lt(feedPostSocialPublishes.updatedAt, cutoff),
      ),
    );
}

/** Результат вызова неизвестен (таймаут) → `failed` без повтора. */
export async function markSocialPublishOutcomeUnknown(
  claim: SocialPublishClaim,
  error: unknown,
): Promise<void> {
  await db
    .update(feedPostSocialPublishes)
    .set({
      status: "failed",
      externalId: null,
      lastError: truncateError(error),
    })
    .where(
      and(
        eq(feedPostSocialPublishes.id, claim.jobId),
        eq(feedPostSocialPublishes.status, "sending"),
        eq(feedPostSocialPublishes.externalId, claim.token),
      ),
    );
}

/**
 * Владелец claim записывает успех. `failed` тоже принимается: догон мог
 * счесть отправку брошенной, пока ждали ответа Telegram (токен он оставляет).
 */
export async function markSocialPublishSent(
  claim: SocialPublishClaim,
  externalId: string | number,
): Promise<boolean> {
  const rows = await db
    .update(feedPostSocialPublishes)
    .set({
      status: "sent",
      externalId: String(externalId),
      lastError: null,
    })
    .where(
      and(
        eq(feedPostSocialPublishes.id, claim.jobId),
        inArray(feedPostSocialPublishes.status, ["sending", "failed"]),
        eq(feedPostSocialPublishes.externalId, claim.token),
      ),
    )
    .returning({ id: feedPostSocialPublishes.id });
  return rows.length === 1;
}

export async function recordSocialPublishFailure(
  jobId: string,
  error: unknown,
  token?: string,
): Promise<void> {
  const rows = await db
    .select()
    .from(feedPostSocialPublishes)
    .where(eq(feedPostSocialPublishes.id, jobId))
    .limit(1);
  const job = rows[0];
  const ownsSending =
    token != null && job?.status === "sending" && job.externalId === token;
  const ownsPending = token == null && job?.status === "pending";
  if (!job || (!ownsSending && !ownsPending)) return;

  const maxRetries = readSocialPublishMaxRetries();
  const next = nextFailureAfterAttempt(job.attemptCount, maxRetries);
  await db
    .update(feedPostSocialPublishes)
    .set({
      attemptCount: next.attemptCount,
      status: next.status,
      lastError: truncateError(error),
      ...(ownsSending ? { externalId: null } : {}),
    })
    .where(
      ownsSending
        ? and(
            eq(feedPostSocialPublishes.id, jobId),
            eq(feedPostSocialPublishes.status, "sending"),
            eq(feedPostSocialPublishes.externalId, token),
          )
        : and(
            eq(feedPostSocialPublishes.id, jobId),
            eq(feedPostSocialPublishes.status, "pending"),
          ),
    );
}

/**
 * `failed`, но попытки не исчерпаны — значит, это таймаут или брошенная
 * отправка: пост мог уже уйти в канал.
 */
export function socialPublishOutcomeUnknown(
  job: Pick<SocialPublishJobRow, "status" | "attemptCount">,
  maxRetries = readSocialPublishMaxRetries(),
): boolean {
  return job.status === "failed" && job.attemptCount < maxRetries;
}

/** Админ: `failed` → `pending` с нуля попыток. false — строка уже не `failed`. */
export async function requeueFailedSocialPublish(
  postId: string,
  channel: SocialPublishChannel,
): Promise<boolean> {
  const rows = await db
    .update(feedPostSocialPublishes)
    .set({
      status: "pending",
      attemptCount: 0,
      externalId: null,
      lastError: null,
    })
    .where(
      and(
        eq(feedPostSocialPublishes.feedPostId, postId),
        eq(feedPostSocialPublishes.channel, channel),
        eq(feedPostSocialPublishes.status, "failed"),
      ),
    )
    .returning({ id: feedPostSocialPublishes.id });
  return rows.length === 1;
}

/** Админ проверил канал: пост там есть. `failed` → `sent` без отправки. */
export async function markFailedSocialPublishSent(
  postId: string,
  channel: SocialPublishChannel,
): Promise<boolean> {
  const rows = await db
    .update(feedPostSocialPublishes)
    .set({ status: "sent", externalId: null, lastError: null })
    .where(
      and(
        eq(feedPostSocialPublishes.feedPostId, postId),
        eq(feedPostSocialPublishes.channel, channel),
        eq(feedPostSocialPublishes.status, "failed"),
      ),
    )
    .returning({ id: feedPostSocialPublishes.id });
  return rows.length === 1;
}
