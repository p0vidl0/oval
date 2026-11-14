import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { feedPostSocialPublishes } from "@/lib/db/schema";
import {
  claimSocialPublishJob,
  failStaleSocialPublishClaims,
  markFailedSocialPublishSent,
  markSocialPublishSent,
  recordSocialPublishFailure,
  requeueFailedSocialPublish,
  SOCIAL_PUBLISH_CLAIM_STALE_MS,
  SOCIAL_PUBLISH_STALE_CLAIM_ERROR,
  socialPublishOutcomeUnknown,
  touchSocialPublishClaim,
} from "@/lib/feed/social-publish-jobs";
import { insertFeedPost } from "@/tests/helpers/insert-feed-post";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

async function seedPendingJob(): Promise<{ postId: string; jobId: string }> {
  const postId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  await insertFeedPost({
    id: postId,
    type: "news",
    title: postId,
    status: "published",
    publishedAt: new Date(),
    publishToTelegram: true,
  });
  await db.insert(feedPostSocialPublishes).values({
    id: jobId,
    feedPostId: postId,
    channel: "telegram",
    status: "pending",
  });
  return { postId, jobId };
}

run("social publish claim", () => {
  useIntegrationDb();

  it("lets only one concurrent claim win", async () => {
    const { jobId } = await seedPendingJob();
    const results = await Promise.all([
      claimSocialPublishJob(jobId),
      claimSocialPublishJob(jobId),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);

    const rows = await db
      .select()
      .from(feedPostSocialPublishes)
      .where(eq(feedPostSocialPublishes.id, jobId));
    expect(rows[0]?.status).toBe("sending");
  });

  it("counts a failed send and allows another claim", async () => {
    const { jobId } = await seedPendingJob();
    const claim = await claimSocialPublishJob(jobId);
    expect(claim).not.toBeNull();
    expect(await claimSocialPublishJob(jobId)).toBeNull();

    await recordSocialPublishFailure(
      jobId,
      new Error("telegram down"),
      claim?.token,
    );

    const rows = await db
      .select()
      .from(feedPostSocialPublishes)
      .where(eq(feedPostSocialPublishes.id, jobId));
    expect(rows[0]?.status).toBe("pending");
    expect(rows[0]?.attemptCount).toBe(1);
    expect(rows[0]?.externalId).toBeNull();
    expect(await claimSocialPublishJob(jobId)).not.toBeNull();
  });

  it("does not let a stale owner revive a failed claim", async () => {
    const { jobId } = await seedPendingJob();
    const first = await claimSocialPublishJob(jobId);
    expect(first).not.toBeNull();

    await db
      .update(feedPostSocialPublishes)
      .set({
        updatedAt: new Date(Date.now() - SOCIAL_PUBLISH_CLAIM_STALE_MS - 1000),
      })
      .where(eq(feedPostSocialPublishes.id, jobId));
    await failStaleSocialPublishClaims();

    expect(await claimSocialPublishJob(jobId)).toBeNull();
    await recordSocialPublishFailure(jobId, new Error("late"), first?.token);

    const rows = await db
      .select()
      .from(feedPostSocialPublishes)
      .where(eq(feedPostSocialPublishes.id, jobId));
    expect(rows[0]?.status).toBe("failed");
    expect(rows[0]?.lastError).toBe(SOCIAL_PUBLISH_STALE_CLAIM_ERROR);
    expect(rows[0]?.attemptCount).toBe(0);
  });

  it("keeps a touched claim out of the stale sweep", async () => {
    const { jobId } = await seedPendingJob();
    const claim = await claimSocialPublishJob(jobId);
    expect(claim).not.toBeNull();
    if (!claim) return;

    await db
      .update(feedPostSocialPublishes)
      .set({
        updatedAt: new Date(Date.now() - SOCIAL_PUBLISH_CLAIM_STALE_MS - 1000),
      })
      .where(eq(feedPostSocialPublishes.id, jobId));

    expect(await touchSocialPublishClaim(claim)).toBe(true);
    await failStaleSocialPublishClaims();

    const rows = await db
      .select()
      .from(feedPostSocialPublishes)
      .where(eq(feedPostSocialPublishes.id, jobId));
    expect(rows[0]?.status).toBe("sending");
    expect(rows[0]?.externalId).toBe(claim.token);
  });

  it("fails a stale sending row and leaves a fresh one", async () => {
    const stale = await seedPendingJob();
    const fresh = await seedPendingJob();
    expect(await claimSocialPublishJob(stale.jobId)).not.toBeNull();
    expect(await claimSocialPublishJob(fresh.jobId)).not.toBeNull();

    await db
      .update(feedPostSocialPublishes)
      .set({
        updatedAt: new Date(Date.now() - SOCIAL_PUBLISH_CLAIM_STALE_MS - 1000),
      })
      .where(eq(feedPostSocialPublishes.id, stale.jobId));

    await failStaleSocialPublishClaims();

    const rows = await db.select().from(feedPostSocialPublishes);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId[stale.jobId]?.status).toBe("failed");
    expect(byId[stale.jobId]?.lastError).toBe(SOCIAL_PUBLISH_STALE_CLAIM_ERROR);
    expect(byId[fresh.jobId]?.status).toBe("sending");
  });

  it("requeues only a failed row, from zero attempts", async () => {
    const { postId, jobId } = await seedPendingJob();
    expect(await requeueFailedSocialPublish(postId, "telegram")).toBe(false);

    await db
      .update(feedPostSocialPublishes)
      .set({ status: "failed", attemptCount: 3, lastError: "boom" })
      .where(eq(feedPostSocialPublishes.id, jobId));
    expect(await requeueFailedSocialPublish(postId, "telegram")).toBe(true);
    expect(await requeueFailedSocialPublish(postId, "telegram")).toBe(false);

    const row = (
      await db
        .select()
        .from(feedPostSocialPublishes)
        .where(eq(feedPostSocialPublishes.id, jobId))
    )[0];
    expect(row?.status).toBe("pending");
    expect(row?.attemptCount).toBe(0);
    expect(row?.lastError).toBeNull();
    expect(await claimSocialPublishJob(jobId)).not.toBeNull();
  });

  it("marks a failed row sent without touching other statuses", async () => {
    const { postId, jobId } = await seedPendingJob();
    expect(await markFailedSocialPublishSent(postId, "telegram")).toBe(false);

    await db
      .update(feedPostSocialPublishes)
      .set({ status: "failed", lastError: SOCIAL_PUBLISH_STALE_CLAIM_ERROR })
      .where(eq(feedPostSocialPublishes.id, jobId));
    expect(await markFailedSocialPublishSent(postId, "telegram")).toBe(true);

    const row = (
      await db
        .select()
        .from(feedPostSocialPublishes)
        .where(eq(feedPostSocialPublishes.id, jobId))
    )[0];
    expect(row?.status).toBe("sent");
    expect(row?.lastError).toBeNull();
    expect(await requeueFailedSocialPublish(postId, "telegram")).toBe(false);
  });

  it("tells an unknown outcome from exhausted retries", () => {
    expect(
      socialPublishOutcomeUnknown({ status: "failed", attemptCount: 0 }, 3),
    ).toBe(true);
    expect(
      socialPublishOutcomeUnknown({ status: "failed", attemptCount: 3 }, 3),
    ).toBe(false);
    expect(
      socialPublishOutcomeUnknown({ status: "pending", attemptCount: 0 }, 3),
    ).toBe(false);
  });

  it("lets a live owner record success after the stale sweep", async () => {
    const { postId, jobId } = await seedPendingJob();
    const claim = await claimSocialPublishJob(jobId);
    if (!claim) throw new Error("no claim");
    await db
      .update(feedPostSocialPublishes)
      .set({
        updatedAt: new Date(Date.now() - SOCIAL_PUBLISH_CLAIM_STALE_MS - 1000),
      })
      .where(eq(feedPostSocialPublishes.id, jobId));
    await failStaleSocialPublishClaims();

    expect(await markSocialPublishSent(claim, 319)).toBe(true);
    const row = (
      await db
        .select()
        .from(feedPostSocialPublishes)
        .where(eq(feedPostSocialPublishes.id, jobId))
    )[0];
    expect(row?.status).toBe("sent");
    expect(row?.externalId).toBe("319");
    expect(row?.lastError).toBeNull();
    expect(await requeueFailedSocialPublish(postId, "telegram")).toBe(false);
  });

  it("does not let an old owner mark sent after an admin requeue", async () => {
    const { postId, jobId } = await seedPendingJob();
    const claim = await claimSocialPublishJob(jobId);
    if (!claim) throw new Error("no claim");
    await db
      .update(feedPostSocialPublishes)
      .set({
        updatedAt: new Date(Date.now() - SOCIAL_PUBLISH_CLAIM_STALE_MS - 1000),
      })
      .where(eq(feedPostSocialPublishes.id, jobId));
    await failStaleSocialPublishClaims();
    expect(await requeueFailedSocialPublish(postId, "telegram")).toBe(true);

    expect(await markSocialPublishSent(claim, 319)).toBe(false);
  });
});
