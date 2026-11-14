import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSocialPublishRateLimitsForTests } from "@/lib/bots/social-publish/rate-limit";
import {
  sendTelegramMediaGroupUpload,
  sendTelegramMessage,
} from "@/lib/bots/telegram/api";
import { tryPublishFeedPostToTelegramChannel } from "@/lib/bots/telegram/publish-feed-post";
import { db } from "@/lib/db/client";
import { feedPostSocialPublishes } from "@/lib/db/schema";
import { listImagesForPost } from "@/lib/feed/post-images";
import {
  claimSocialPublishJob,
  markSocialPublishSent,
  requeueFailedSocialPublish,
  SOCIAL_PUBLISH_CLAIM_STALE_MS,
  SOCIAL_PUBLISH_STALE_CLAIM_ERROR,
} from "@/lib/feed/social-publish-jobs";
import { sweepPendingSocialPublishes } from "@/lib/feed/social-publish-sweep";
import { insertFeedPost } from "@/tests/helpers/insert-feed-post";
import { useIntegrationDb } from "./helpers/setup";

vi.mock("@/lib/bots/telegram/api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/bots/telegram/api")>();
  return {
    ...actual,
    sendTelegramMessage: vi.fn(),
    sendTelegramPhotoUpload: vi.fn(),
    sendTelegramMediaGroupUpload: vi.fn(),
  };
});

// Инцидент: after() и догон жили в разных бандлах, замок в памяти не делился.
vi.mock("@/lib/bots/social-publish/in-flight-lock", () => ({
  tryAcquireInFlightLock: () => true,
  releaseInFlightLock: () => {},
  resetInFlightLocksForTests: () => {},
}));

vi.mock("@/lib/feed/post-images", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/feed/post-images")>();
  return { ...actual, listImagesForPost: vi.fn() };
});

vi.mock("@/lib/uploads/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/uploads/storage")>();
  return {
    ...actual,
    readPostUploadFile: vi.fn(async (storageKey: string) => ({
      storageKey,
      filename: storageKey,
      contentType: "image/jpeg",
      data: Buffer.from("jpg"),
    })),
  };
});

vi.mock("@/lib/feed/social-publish-jobs", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/feed/social-publish-jobs")>();
  return {
    ...actual,
    claimSocialPublishJob: vi.fn(actual.claimSocialPublishJob),
    markSocialPublishSent: vi.fn(actual.markSocialPublishSent),
  };
});

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

const sendMessage = vi.mocked(sendTelegramMessage);
const sendMediaGroup = vi.mocked(sendTelegramMediaGroupUpload);
const listImages = vi.mocked(listImagesForPost);
const markSent = vi.mocked(markSocialPublishSent);
const claimJob = vi.mocked(claimSocialPublishJob);

type JobsModule = typeof import("@/lib/feed/social-publish-jobs");
let actualJobs: JobsModule;

function delayed<T>(value: T, ms = 50): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

async function seedPendingJob(): Promise<{ postId: string; jobId: string }> {
  const postId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  await insertFeedPost({
    id: postId,
    type: "news",
    title: "Тренировка",
    body: "Текст",
    status: "published",
    publishedAt: new Date(Date.now() - 1000),
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

async function jobRow(jobId: string) {
  const rows = await db
    .select()
    .from(feedPostSocialPublishes)
    .where(eq(feedPostSocialPublishes.id, jobId));
  return rows[0];
}

run("telegram channel publish", () => {
  useIntegrationDb();

  beforeEach(async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "7000000000:AAIntegrationTestToken");
    vi.stubEnv("TELEGRAM_CHANNEL_ID", "@oval_test_channel");
    resetSocialPublishRateLimitsForTests();
    sendMessage.mockReset();
    sendMediaGroup.mockReset();
    listImages.mockReset().mockResolvedValue([]);
    actualJobs = await vi.importActual<JobsModule>(
      "@/lib/feed/social-publish-jobs",
    );
    markSent.mockReset().mockImplementation(actualJobs.markSocialPublishSent);
    claimJob.mockReset().mockImplementation(actualJobs.claimSocialPublishJob);
  });

  it("sends once when after() and the sweep race on one post", async () => {
    const { postId, jobId } = await seedPendingJob();
    sendMessage.mockImplementation(() => delayed({ messageId: 319 }));

    // Оба пути (after() и догон) прочитали `pending` и дошли до claim вместе.
    let arrived = 0;
    let openGate = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    claimJob.mockImplementation(async (id) => {
      arrived += 1;
      if (arrived === 2) openGate();
      await gate;
      return actualJobs.claimSocialPublishJob(id);
    });

    await Promise.all([
      tryPublishFeedPostToTelegramChannel(postId),
      tryPublishFeedPostToTelegramChannel(postId),
    ]);
    expect(arrived).toBe(2);
    await sweepPendingSocialPublishes();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const row = await jobRow(jobId);
    expect(row?.status).toBe("sent");
    expect(row?.externalId).toBe("319");
  });

  it("does not resend an album when the button message fails", async () => {
    const { postId, jobId } = await seedPendingJob();
    listImages.mockResolvedValue([
      { storageKey: "a.jpg" },
      { storageKey: "b.jpg" },
    ] as Awaited<ReturnType<typeof listImagesForPost>>);
    sendMediaGroup.mockResolvedValue({ messageIds: [400, 401] });
    sendMessage.mockRejectedValue(new Error("Telegram sendMessage failed"));

    await tryPublishFeedPostToTelegramChannel(postId);
    await sweepPendingSocialPublishes();

    expect(sendMediaGroup).toHaveBeenCalledTimes(1);
    const row = await jobRow(jobId);
    expect(row?.status).toBe("sent");
    expect(row?.externalId).toBe("400");
  });

  it("fails without retry when the API call times out", async () => {
    const { postId, jobId } = await seedPendingJob();
    sendMessage.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    await tryPublishFeedPostToTelegramChannel(postId);
    await sweepPendingSocialPublishes();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const row = await jobRow(jobId);
    expect(row?.status).toBe("failed");
    expect(row?.externalId).toBeNull();
  });

  it("keeps a definite API error retryable", async () => {
    const { postId, jobId } = await seedPendingJob();
    sendMessage.mockRejectedValueOnce(
      new Error("Telegram sendMessage failed: 400 Bad Request"),
    );

    await tryPublishFeedPostToTelegramChannel(postId);

    const row = await jobRow(jobId);
    expect(row?.status).toBe("pending");
    expect(row?.attemptCount).toBe(1);
  });

  it("retries only the sent mark when it fails after delivery", async () => {
    const { postId, jobId } = await seedPendingJob();
    sendMessage.mockResolvedValue({ messageId: 500 });
    markSent.mockRejectedValueOnce(new Error("db hiccup"));

    await tryPublishFeedPostToTelegramChannel(postId);
    await sweepPendingSocialPublishes();

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const row = await jobRow(jobId);
    expect(row?.status).toBe("sent");
    expect(row?.externalId).toBe("500");
  });

  it("fails a delivered post whose sent mark never lands, without resending", async () => {
    const { postId, jobId } = await seedPendingJob();
    sendMessage.mockResolvedValue({ messageId: 600 });
    markSent.mockRejectedValue(new Error("db down"));

    await tryPublishFeedPostToTelegramChannel(postId);
    expect((await jobRow(jobId))?.status).toBe("sending");

    await sweepPendingSocialPublishes(
      new Date(Date.now() + SOCIAL_PUBLISH_CLAIM_STALE_MS + 1000),
    );

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const row = await jobRow(jobId);
    expect(row?.status).toBe("failed");
    expect(row?.lastError).toBe(SOCIAL_PUBLISH_STALE_CLAIM_ERROR);
  });

  it("sends again after an admin requeues a failed post", async () => {
    const { postId, jobId } = await seedPendingJob();
    sendMessage.mockRejectedValueOnce(
      new DOMException("The operation timed out.", "TimeoutError"),
    );
    await tryPublishFeedPostToTelegramChannel(postId);
    expect((await jobRow(jobId))?.status).toBe("failed");

    expect(await requeueFailedSocialPublish(postId, "telegram")).toBe(true);
    sendMessage.mockResolvedValueOnce({ messageId: 700 });
    await tryPublishFeedPostToTelegramChannel(postId);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    const row = await jobRow(jobId);
    expect(row?.status).toBe("sent");
    expect(row?.externalId).toBe("700");
  });
});
