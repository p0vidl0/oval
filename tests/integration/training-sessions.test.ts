import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { removePostImages } from "@/lib/admin/save-post-images";
import { db } from "@/lib/db/client";
import {
  feedPosts,
  payments,
  postImages,
  registrations,
  trainingSessionEvents,
  trainingSessions,
} from "@/lib/db/schema";
import { listImagesForPost } from "@/lib/feed/post-images";
import { listPublishedFeedPosts } from "@/lib/feed/queries";
import {
  getAdminSession,
  listAdminSessions,
  listPaidOnCancelled,
  listSessionRegistrationsAdmin,
} from "@/lib/training/admin-queries";
import { cancelUserRegistration } from "@/lib/training/registrations";
import {
  cancelTrainingSession,
  createTrainingSession,
  refundAllPaid,
  refundRegistration,
  rescheduleTrainingSession,
  TrainingServiceError,
  transferRegistration,
  updateTrainingSettings,
} from "@/lib/training/session-service";
import {
  seedPublishedAnnouncement,
  seedRegistration,
  seedUser,
} from "./helpers/seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

const settings = {
  title: "Техничная",
  priceCents: 60000,
  capacity: 10,
  registrationEnabled: true,
  onlinePaymentEnabled: false,
};

const schedule = {
  startsAt: new Date("2027-02-01T14:00:00Z"),
  endsAt: new Date("2027-02-01T15:00:00Z"),
  gatherAt: new Date("2027-02-01T13:30:00Z"),
};

async function seedPaid(userId: string, sessionId: string, amount = 50000) {
  const regId = await seedRegistration(userId, sessionId, "paid");
  await db.insert(payments).values({
    id: crypto.randomUUID(),
    userId,
    registrationId: regId,
    amountCents: amount,
    status: "succeeded",
    provider: "mock",
  });
  return regId;
}

async function regStatus(id: string) {
  const rows = await db
    .select()
    .from(registrations)
    .where(eq(registrations.id, id));
  return rows[0];
}

run("training sessions", () => {
  useIntegrationDb();

  it("creates training with announcement and created event", async () => {
    const { sessionId, announcementPostId } = await createTrainingSession({
      settings,
      schedule,
      announcement: {
        title: "",
        body: "Ждём",
        publishedAt: new Date(),
        pinned: false,
      },
      actorUserId: null,
    });
    expect(announcementPostId).toBeTruthy();
    const post = (
      await db
        .select()
        .from(feedPosts)
        .where(eq(feedPosts.id, announcementPostId as string))
    )[0];
    expect(post?.relatedSessionId).toBe(sessionId);
    expect(post?.title).toBe("Техничная");
    const events = await db
      .select()
      .from(trainingSessionEvents)
      .where(eq(trainingSessionEvents.sessionId, sessionId));
    expect(events.map((e) => e.kind)).toEqual(["created"]);
  });

  it("training without announcement", async () => {
    const { sessionId, announcementPostId } = await createTrainingSession({
      settings,
      schedule,
      announcement: null,
      actorUserId: null,
    });
    expect(announcementPostId).toBeNull();
    const row = await getAdminSession(sessionId);
    expect(row?.announcement).toBeNull();
    expect(row?.session.title).toBe("Техничная");
  });

  it("settings: schedule locked once someone registered", async () => {
    const userId = await seedUser("settings-user");
    const { sessionId } = await seedPublishedAnnouncement();
    await seedRegistration(userId, sessionId);
    await expect(
      updateTrainingSettings({
        sessionId,
        settings,
        schedule,
        actorUserId: null,
      }),
    ).rejects.toBeInstanceOf(TrainingServiceError);

    await updateTrainingSettings({
      sessionId,
      settings: { ...settings, capacity: 5 },
      schedule: null,
      actorUserId: null,
    });
    const row = await getAdminSession(sessionId);
    expect(row?.session.capacity).toBe(5);
    const events = await db
      .select()
      .from(trainingSessionEvents)
      .where(eq(trainingSessionEvents.sessionId, sessionId));
    expect(events.map((e) => e.kind)).toContain("updated");
  });

  it("settings: capacity below active registrations is rejected", async () => {
    const { sessionId } = await seedPublishedAnnouncement({ capacity: 5 });
    await seedRegistration(await seedUser("cap-a"), sessionId);
    await seedRegistration(await seedUser("cap-b"), sessionId);
    await expect(
      updateTrainingSettings({
        sessionId,
        settings: { ...settings, capacity: 1 },
        actorUserId: null,
      }),
    ).rejects.toThrow("Лимит мест меньше");
  });

  it("reschedule moves time, keeps registrations, optional post", async () => {
    const userId = await seedUser("resched-user");
    const { sessionId } = await seedPublishedAnnouncement();
    const regId = await seedRegistration(userId, sessionId);

    const { postId } = await rescheduleTrainingSession({
      sessionId,
      schedule,
      post: { mode: "none", title: "", body: "" },
      actorUserId: null,
    });
    expect(postId).toBeNull();
    expect((await regStatus(regId))?.status).toBe("pending_payment");

    const row = await getAdminSession(sessionId);
    expect(row?.session.startsAt.toISOString()).toBe(
      schedule.startsAt.toISOString(),
    );
    expect(row?.wasRescheduled).toBe(true);
  });

  it("cancel releases unpaid, keeps paid, publishes post", async () => {
    const { sessionId } = await seedPublishedAnnouncement();
    const unpaidId = await seedRegistration(
      await seedUser("cancel-unpaid"),
      sessionId,
    );
    const paidId = await seedPaid(await seedUser("cancel-paid"), sessionId);

    const { postId, releasedCount } = await cancelTrainingSession({
      sessionId,
      reason: "дождь",
      post: { mode: "publish", title: "Тренировка отменена", body: "" },
      actorUserId: null,
    });
    expect(releasedCount).toBe(1);
    expect(await regStatus(unpaidId)).toMatchObject({
      status: "cancelled",
      cancelledBy: "session_cancelled",
    });
    expect((await regStatus(paidId))?.status).toBe("paid");

    const session = (
      await db
        .select()
        .from(trainingSessions)
        .where(eq(trainingSessions.id, sessionId))
    )[0];
    expect(session?.status).toBe("cancelled");
    expect(session?.cancellationReason).toBe("дождь");

    const published = await listPublishedFeedPosts();
    expect(published.some((p) => p.id === postId)).toBe(true);

    const attention = await listPaidOnCancelled({ page: 1, size: 10 });
    expect(attention.items.map((r) => r.registration.id)).toEqual([paidId]);
    expect(
      (await listAdminSessions("cancelled")).items.map((r) => r.session.id),
    ).toEqual([sessionId]);

    await expect(
      cancelTrainingSession({
        sessionId,
        reason: "",
        post: { mode: "none", title: "", body: "" },
        actorUserId: null,
      }),
    ).rejects.toThrow("уже отменена");
  });

  it("refund marks registration refunded and payment cancelled", async () => {
    const { sessionId } = await seedPublishedAnnouncement();
    const regId = await seedPaid(await seedUser("refund-user"), sessionId);
    await refundRegistration({ registrationId: regId, actorUserId: null });
    expect((await regStatus(regId))?.status).toBe("refunded");
    const pay = await db
      .select()
      .from(payments)
      .where(eq(payments.registrationId, regId));
    expect(pay[0]?.status).toBe("cancelled");
    expect(pay[0]?.metadata).toHaveProperty("refundedAt");

    const closed = await listSessionRegistrationsAdmin(sessionId, "closed");
    expect(closed.map((r) => r.registration.id)).toEqual([regId]);
  });

  it("refundAllPaid handles every paid registration", async () => {
    const { sessionId } = await seedPublishedAnnouncement({ capacity: 5 });
    await seedPaid(await seedUser("bulk-1"), sessionId);
    await seedPaid(await seedUser("bulk-2"), sessionId);
    const { count } = await refundAllPaid({ sessionId, actorUserId: null });
    expect(count).toBe(2);
    expect(await listSessionRegistrationsAdmin(sessionId, "paid")).toHaveLength(
      0,
    );
  });

  it("transfer marks source transferred and creates paid target", async () => {
    const userId = await seedUser("transfer-user");
    const { sessionId: from } = await seedPublishedAnnouncement();
    const { sessionId: to } = await seedPublishedAnnouncement({
      startsAt: new Date("2027-03-01T14:00:00Z"),
    });
    const regId = await seedPaid(userId, from);
    await transferRegistration({ registrationId: regId, targetSessionId: to });
    expect((await regStatus(regId))?.status).toBe("transferred");
    const target = await listSessionRegistrationsAdmin(to, "paid");
    expect(target[0]?.registration.transferredFromRegistrationId).toBe(regId);

    // Деньги «переезжают» вместе с записью.
    expect(await getAdminSession(from)).toMatchObject({
      paid: 0,
      collectedCents: 0,
    });
    expect(await getAdminSession(to)).toMatchObject({
      paid: 1,
      collectedCents: 50000,
    });
  });

  it("user cancel records source", async () => {
    const userId = await seedUser("self-cancel");
    const { sessionId } = await seedPublishedAnnouncement();
    const regId = await seedRegistration(userId, sessionId);
    await cancelUserRegistration(regId, userId, false);
    expect((await regStatus(regId))?.cancelledBy).toBe("user");
  });

  it("domain rows cannot be hard-deleted with dependants", async () => {
    const { sessionId, postId } = await seedPublishedAnnouncement();
    await seedRegistration(await seedUser("fk-user"), sessionId);
    await expect(
      db.delete(trainingSessions).where(eq(trainingSessions.id, sessionId)),
    ).rejects.toThrow();
    await db.insert(postImages).values({
      id: crypto.randomUUID(),
      postId,
      storageKey: "x.jpg",
    });
    await expect(
      db.delete(feedPosts).where(eq(feedPosts.id, postId)),
    ).rejects.toThrow();
  });

  it("removing a photo keeps the row", async () => {
    const { postId } = await seedPublishedAnnouncement();
    const imageId = crypto.randomUUID();
    await db
      .insert(postImages)
      .values({ id: imageId, postId, storageKey: "y.jpg" });
    await removePostImages(postId, [imageId]);
    expect(await listImagesForPost(postId)).toHaveLength(0);
    const raw = await db
      .select()
      .from(postImages)
      .where(eq(postImages.id, imageId));
    expect(raw[0]?.removedAt).toBeInstanceOf(Date);
  });

  it("only one announcement per training", async () => {
    const { sessionId } = await seedPublishedAnnouncement();
    await expect(
      db.insert(feedPosts).values({
        id: crypto.randomUUID(),
        type: "training_announcement",
        title: "Второй анонс",
        relatedSessionId: sessionId,
      }),
    ).rejects.toThrow();
  });
});
