import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { removePostImages } from "@/lib/admin/save-post-images";
import { db } from "@/lib/db/client";
import {
  feedPosts,
  payments,
  postImages,
  registrationEvents,
  registrations,
  trainingSessionEvents,
  trainingSessions,
} from "@/lib/db/schema";
import { listImagesForPost } from "@/lib/feed/post-images";
import { listPublishedFeedPosts } from "@/lib/feed/queries";
import { ensurePaymentForRegistration } from "@/lib/payments/checkout";
import { markRegistrationPaid } from "@/lib/payments/mark-paid";
import {
  getAdminSession,
  listAdminSessions,
  listPaidOnCancelled,
  listSessionRegistrationsAdmin,
} from "@/lib/training/admin-queries";
import {
  cancelUserRegistration,
  registerUserForSession,
} from "@/lib/training/registrations";
import {
  cancelTrainingSession,
  createTrainingSession,
  refundAllPaid,
  refundRegistration,
  rescheduleTrainingSession,
  TrainingServiceError,
  transferAllPaid,
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
        publishToTelegram: false,
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
    expect(await regStatus(regId)).toMatchObject({
      status: "active",
      paymentState: "due",
    });

    const row = await getAdminSession(sessionId);
    expect(row?.session.startsAt.toISOString()).toBe(
      schedule.startsAt.toISOString(),
    );
    expect(row?.wasRescheduled).toBe(true);
  });

  it("cancel releases unpaid and free, keeps paid, publishes post", async () => {
    const { sessionId } = await seedPublishedAnnouncement({ capacity: 5 });
    const unpaidId = await seedRegistration(
      await seedUser("cancel-unpaid"),
      sessionId,
    );
    const freeId = await seedRegistration(
      await seedUser("cancel-free"),
      sessionId,
      "free",
    );
    const paidId = await seedPaid(await seedUser("cancel-paid"), sessionId);

    const { postId, releasedCount } = await cancelTrainingSession({
      sessionId,
      reason: "дождь",
      post: { mode: "publish", title: "Тренировка отменена", body: "" },
      actorUserId: null,
    });
    expect(releasedCount).toBe(2);
    for (const id of [unpaidId, freeId]) {
      expect(await regStatus(id)).toMatchObject({
        status: "cancelled",
        cancelledBy: "session_cancelled",
      });
    }
    expect(await regStatus(paidId)).toMatchObject({
      status: "active",
      paymentState: "paid",
    });
    const released = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.kind, "released"));
    expect(released.map((e) => e.registrationId).sort()).toEqual(
      [unpaidId, freeId].sort(),
    );

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
    const adminId = await seedUser("refund-admin");
    await refundRegistration({ registrationId: regId, actorUserId: adminId });
    expect(await regStatus(regId)).toMatchObject({
      status: "cancelled",
      cancelledBy: "admin",
      paymentState: "refunded",
    });
    const [event] = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.registrationId, regId));
    expect(event).toMatchObject({ kind: "refunded", actorUserId: adminId });
    const pay = await db
      .select()
      .from(payments)
      .where(eq(payments.registrationId, regId));
    expect(pay[0]?.status).toBe("cancelled");
    expect(pay[0]?.metadata).toHaveProperty("refundedAt");

    const closed = await listSessionRegistrationsAdmin(sessionId, "closed");
    expect(closed.map((r) => r.registration.id)).toEqual([regId]);
  });

  it("refundAllPaid handles every paid registration, not free ones", async () => {
    const { sessionId } = await seedPublishedAnnouncement({ capacity: 5 });
    await seedPaid(await seedUser("bulk-1"), sessionId);
    await seedPaid(await seedUser("bulk-2"), sessionId);
    const freeId = await seedRegistration(
      await seedUser("bulk-free"),
      sessionId,
      "free",
    );
    const { count } = await refundAllPaid({ sessionId, actorUserId: null });
    expect(count).toBe(2);
    expect((await regStatus(freeId))?.paymentState).toBe("free");
    // «Оплатили» включает бесплатные: осталась только она.
    const remaining = await listSessionRegistrationsAdmin(sessionId, "paid");
    expect(remaining.map((r) => r.registration.id)).toEqual([freeId]);
  });

  it("transfer marks source transferred and creates paid target", async () => {
    const userId = await seedUser("transfer-user");
    const { sessionId: from } = await seedPublishedAnnouncement();
    const { sessionId: to } = await seedPublishedAnnouncement({
      startsAt: new Date("2027-03-01T14:00:00Z"),
    });
    const regId = await seedPaid(userId, from);
    await transferRegistration({
      registrationId: regId,
      targetSessionId: to,
      actorUserId: null,
    });
    expect(await regStatus(regId)).toMatchObject({
      status: "cancelled",
      cancelledBy: "transferred",
      paymentState: "moved",
    });
    const target = await listSessionRegistrationsAdmin(to, "paid");
    expect(target[0]?.registration).toMatchObject({
      transferredFromRegistrationId: regId,
      paymentState: "paid",
    });
    const kinds = await db
      .select({ kind: registrationEvents.kind })
      .from(registrationEvents);
    expect(kinds.map((k) => k.kind).sort()).toEqual([
      "transferred_in",
      "transferred_out",
    ]);

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

  it("re-registration after refund is a new row that can be paid", async () => {
    const userId = await seedUser("refund-again");
    const coachId = await seedUser("refund-again-coach");
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 70000,
    });
    const regId = await seedPaid(userId, sessionId);
    await refundRegistration({ registrationId: regId, actorUserId: null });

    const again = await registerUserForSession(userId, sessionId);
    if (!again.ok) throw new Error(again.error);
    expect(again.registrationId).not.toBe(regId);

    const ensured = await ensurePaymentForRegistration(
      again.registrationId,
      userId,
    );
    expect(ensured.ok && ensured.payment).toMatchObject({
      status: "pending",
      amountCents: 70000,
    });

    const paid = await markRegistrationPaid({
      registrationId: again.registrationId,
      source: "admin_onsite",
      actorUserId: coachId,
    });
    expect(paid).toEqual({ ok: true, already: false });
    expect(await regStatus(again.registrationId)).toMatchObject({
      status: "active",
      paymentState: "paid",
    });
    // Старая запись и её возврат не тронуты.
    expect((await regStatus(regId))?.paymentState).toBe("refunded");
    const [oldPay] = await db
      .select()
      .from(payments)
      .where(eq(payments.registrationId, regId));
    expect(oldPay?.status).toBe("cancelled");
    const [event] = await db
      .select()
      .from(registrationEvents)
      .where(
        and(
          eq(registrationEvents.registrationId, again.registrationId),
          eq(registrationEvents.kind, "payment_succeeded"),
        ),
      );
    expect(event).toMatchObject({ actorUserId: coachId });
    expect(event?.payload).toMatchObject({ source: "admin_onsite" });
  });

  it("re-registration on the transfer source can be marked paid", async () => {
    const userId = await seedUser("transfer-back");
    const coachId = await seedUser("transfer-back-coach");
    const { sessionId: from } = await seedPublishedAnnouncement();
    const { sessionId: to } = await seedPublishedAnnouncement({
      startsAt: new Date("2027-03-01T14:00:00Z"),
    });
    const regId = await seedPaid(userId, from);
    await transferRegistration({
      registrationId: regId,
      targetSessionId: to,
      actorUserId: null,
    });

    const again = await registerUserForSession(userId, from);
    if (!again.ok) throw new Error(again.error);
    expect(again.registrationId).not.toBe(regId);
    const paid = await markRegistrationPaid({
      registrationId: again.registrationId,
      source: "admin_onsite",
      actorUserId: coachId,
    });
    expect(paid).toEqual({ ok: true, already: false });
    expect((await regStatus(again.registrationId))?.paymentState).toBe("paid");
  });

  it("on-site payment stores the chosen method", async () => {
    const coachId = await seedUser("method-coach");
    const { sessionId } = await seedPublishedAnnouncement({ capacity: 5 });
    const transferReg = await seedRegistration(
      await seedUser("method-transfer"),
      sessionId,
    );
    const cashReg = await seedRegistration(
      await seedUser("method-cash"),
      sessionId,
    );
    await markRegistrationPaid({
      registrationId: transferReg,
      source: "admin_onsite",
      actorUserId: coachId,
      method: "bank_transfer",
    });
    await markRegistrationPaid({
      registrationId: cashReg,
      source: "admin_onsite",
      actorUserId: coachId,
    });
    const methods = await db
      .select({
        registrationId: payments.registrationId,
        method: payments.method,
      })
      .from(payments);
    expect(
      Object.fromEntries(methods.map((m) => [m.registrationId, m.method])),
    ).toEqual({
      [transferReg]: "bank_transfer",
      [cashReg]: "cash",
    });
    const [event] = await db
      .select()
      .from(registrationEvents)
      .where(
        and(
          eq(registrationEvents.registrationId, transferReg),
          eq(registrationEvents.kind, "payment_succeeded"),
        ),
      );
    expect(event?.payload).toMatchObject({
      source: "admin_onsite",
      method: "bank_transfer",
    });
  });

  it("transferAllPaid moves every paid registration with events", async () => {
    const adminId = await seedUser("bulk-transfer-admin");
    const { sessionId: from } = await seedPublishedAnnouncement({
      capacity: 5,
    });
    const { sessionId: to } = await seedPublishedAnnouncement({
      capacity: 5,
      startsAt: new Date("2027-04-01T14:00:00Z"),
    });
    const a = await seedPaid(await seedUser("bulk-tr-a"), from);
    const b = await seedPaid(await seedUser("bulk-tr-b"), from);
    const due = await seedRegistration(await seedUser("bulk-tr-due"), from);

    const { count } = await transferAllPaid({
      sessionId: from,
      targetSessionId: to,
      actorUserId: adminId,
    });
    expect(count).toBe(2);
    for (const id of [a, b]) {
      expect(await regStatus(id)).toMatchObject({
        status: "cancelled",
        paymentState: "moved",
      });
    }
    expect((await regStatus(due))?.paymentState).toBe("due");
    expect(await getAdminSession(to)).toMatchObject({ taken: 2, paidMoney: 2 });
    const events = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.actorUserId, adminId));
    expect(events).toHaveLength(4);
  });

  it("transfer reuses the active unpaid registration on the target", async () => {
    const userId = await seedUser("reuse-target");
    const { sessionId: from } = await seedPublishedAnnouncement();
    const { sessionId: to } = await seedPublishedAnnouncement({
      startsAt: new Date("2027-05-01T14:00:00Z"),
    });
    const source = await seedPaid(userId, from);
    const targetDue = await seedRegistration(userId, to);

    await transferRegistration({
      registrationId: source,
      targetSessionId: to,
      actorUserId: null,
    });
    expect(await regStatus(targetDue)).toMatchObject({
      status: "active",
      paymentState: "paid",
      transferredFromRegistrationId: source,
    });
    const onTarget = await db
      .select()
      .from(registrations)
      .where(eq(registrations.trainingSessionId, to));
    expect(onTarget).toHaveLength(1);
  });

  it("transfer refuses when the target is already paid", async () => {
    const userId = await seedUser("paid-target");
    const { sessionId: from } = await seedPublishedAnnouncement();
    const { sessionId: to } = await seedPublishedAnnouncement({
      startsAt: new Date("2027-05-02T14:00:00Z"),
    });
    const source = await seedPaid(userId, from);
    await seedPaid(userId, to);
    await expect(
      transferRegistration({
        registrationId: source,
        targetSessionId: to,
        actorUserId: null,
      }),
    ).rejects.toThrow("уже оплатил");
    expect((await regStatus(source))?.paymentState).toBe("paid");
  });

  it("mark paid repairs a legacy row stuck with a cancelled payment", async () => {
    const userId = await seedUser("legacy-stuck");
    const coachId = await seedUser("legacy-coach");
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 70000,
    });
    const regId = await seedRegistration(userId, sessionId);
    await db.insert(payments).values({
      id: crypto.randomUUID(),
      userId,
      registrationId: regId,
      amountCents: 50000,
      status: "cancelled",
      provider: "mock",
    });
    expect(
      await markRegistrationPaid({
        registrationId: regId,
        source: "admin_onsite",
        actorUserId: coachId,
        method: "cash",
      }),
    ).toEqual({ ok: true, already: false });
    const [pay] = await db
      .select()
      .from(payments)
      .where(eq(payments.registrationId, regId));
    expect(pay).toMatchObject({
      status: "succeeded",
      amountCents: 70000,
      method: "cash",
    });
    expect((pay?.metadata as { previous?: unknown[] }).previous).toHaveLength(
      1,
    );
  });

  it("collected money ignores free registrations", async () => {
    const { sessionId } = await seedPublishedAnnouncement({ capacity: 5 });
    await seedPaid(await seedUser("collect-paid"), sessionId);
    await seedRegistration(await seedUser("collect-free"), sessionId, "free");
    expect(await getAdminSession(sessionId)).toMatchObject({
      taken: 2,
      paid: 2,
      paidMoney: 1,
      collectedCents: 50000,
    });
  });

  it("checkout repairs a pending registration stuck with a cancelled payment", async () => {
    const userId = await seedUser("stuck-payment");
    const { sessionId } = await seedPublishedAnnouncement();
    const regId = await seedRegistration(userId, sessionId);
    await db.insert(payments).values({
      id: crypto.randomUUID(),
      userId,
      registrationId: regId,
      amountCents: 50000,
      status: "cancelled",
      provider: "mock",
    });
    const ensured = await ensurePaymentForRegistration(regId, userId);
    expect(ensured.ok && ensured.payment?.status).toBe("pending");
  });

  it("user cancel records source", async () => {
    const userId = await seedUser("self-cancel");
    const { sessionId } = await seedPublishedAnnouncement();
    const regId = await seedRegistration(userId, sessionId);
    await cancelUserRegistration(regId, userId, "participant");
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
    const { insertFeedPost } = await import("@/tests/helpers/insert-feed-post");
    await expect(
      insertFeedPost({
        id: crypto.randomUUID(),
        type: "training_announcement",
        title: "Второй анонс",
        relatedSessionId: sessionId,
      }),
    ).rejects.toThrow();
  });
});
