import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_ROSTER_ANONYMOUS_LABEL,
  publicRosterLabel,
} from "@/lib/auth/user-display";
import { db } from "@/lib/db/client";
import {
  payments,
  registrationEvents,
  registrations,
  user,
} from "@/lib/db/schema";
import {
  cancelUserRegistration,
  listPublicRoster,
  registerUserForSession,
} from "@/lib/training/registrations";
import {
  seedPublishedAnnouncement,
  seedRegistration,
  seedUser,
} from "./helpers/seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("registrations", () => {
  useIntegrationDb();

  it("free session registration is active and free", async () => {
    const userId = await seedUser();
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 0 });
    const result = await registerUserForSession(userId, sessionId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.needsPayment).toBe(false);
    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, result.registrationId));
    expect(rows[0]).toMatchObject({ status: "active", paymentState: "free" });
  });

  it("paid session returns needsPayment", async () => {
    const userId = await seedUser("test-user-2");
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 10000,
    });
    const result = await registerUserForSession(userId, sessionId);
    expect(result).toMatchObject({ ok: true, needsPayment: true });
  });

  it("offline paid session stays pending without payment record", async () => {
    const userId = await seedUser("offline-pay-user");
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 10000,
      onlinePaymentEnabled: false,
    });
    const result = await registerUserForSession(userId, sessionId);
    expect(result).toMatchObject({ ok: true, needsPayment: false });
    if (!result.ok) return;

    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, result.registrationId));
    expect(rows[0]).toMatchObject({ status: "active", paymentState: "due" });

    const payRows = await db
      .select()
      .from(payments)
      .where(eq(payments.registrationId, result.registrationId));
    expect(payRows).toHaveLength(0);
  });

  it("enforces capacity", async () => {
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 10000,
      capacity: 1,
    });
    const u1 = await seedUser("cap-user-1");
    const u2 = await seedUser("cap-user-2");
    expect((await registerUserForSession(u1, sessionId)).ok).toBe(true);
    const second = await registerUserForSession(u2, sessionId);
    expect(second.ok).toBe(false);
  });

  it("allows re-register after cancelled", async () => {
    const userId = await seedUser("reuser-1");
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 0 });
    const first = await registerUserForSession(userId, sessionId);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await db
      .update(registrations)
      .set({ status: "cancelled" })
      .where(eq(registrations.id, first.registrationId));
    const again = await registerUserForSession(userId, sessionId);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    // Новая строка: отменённая остаётся в истории.
    expect(again.registrationId).not.toBe(first.registrationId);
    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.userId, userId));
    expect(rows.map((r) => r.status).sort()).toEqual(["active", "cancelled"]);
  });

  it("second active registration is rejected", async () => {
    const userId = await seedUser("double-active");
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 0 });
    await seedRegistration(userId, sessionId, "free");
    await expect(seedRegistration(userId, sessionId, "free")).rejects.toThrow();
    const again = await registerUserForSession(userId, sessionId);
    expect(again).toEqual({ ok: false, error: "Вы уже записаны" });
  });

  it("registration and cancellation are journaled with the actor", async () => {
    const userId = await seedUser("journal-user");
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 0 });
    const result = await registerUserForSession(userId, sessionId);
    if (!result.ok) throw new Error(result.error);
    await cancelUserRegistration(result.registrationId, userId, "participant");
    const events = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.registrationId, result.registrationId))
      .orderBy(registrationEvents.createdAt);
    expect(events.map((e) => [e.kind, e.actorUserId])).toEqual([
      ["created", userId],
      ["cancelled", userId],
    ]);
  });

  it("blocks registration once the training has started", async () => {
    const userId = await seedUser("late-user");
    const { sessionId } = await seedPublishedAnnouncement({
      startsAt: new Date(Date.now() - 60_000),
    });
    const result = await registerUserForSession(userId, sessionId);
    expect(result).toEqual({ ok: false, error: "Тренировка уже началась" });
  });

  it("paid registration is closed only via refund or transfer", async () => {
    const userId = await seedUser("paid-cancel-user");
    const adminId = await seedUser("paid-cancel-admin");
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 50000,
    });
    const regId = await seedRegistration(userId, sessionId, "paid");

    const self = await cancelUserRegistration(regId, userId, "participant");
    expect(self.ok).toBe(false);

    // Снятие клубом без возврата потеряло бы деньги — только возврат/перенос.
    const byAdmin = await cancelUserRegistration(regId, adminId, "staff");
    expect(byAdmin.ok).toBe(false);
  });

  it("staff removes an unpaid registration of another user", async () => {
    const userId = await seedUser("unpaid-remove-user");
    const adminId = await seedUser("unpaid-remove-admin");
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 50000,
      startsAt: new Date(Date.now() - 60_000),
    });
    const regId = await seedRegistration(userId, sessionId, "due");
    const result = await cancelUserRegistration(regId, adminId, "staff");
    expect(result.ok).toBe(true);
    const [row] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, regId));
    expect(row).toMatchObject({ status: "cancelled", cancelledBy: "admin" });
  });

  it("participant rules apply after start and to other users' registrations", async () => {
    const userId = await seedUser("started-cancel-user");
    const otherId = await seedUser("other-cancel-user");
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 0,
      startsAt: new Date(Date.now() - 60_000),
    });
    const regId = await seedRegistration(userId, sessionId, "free");

    const late = await cancelUserRegistration(regId, userId, "participant");
    expect(late).toEqual({ ok: false, error: "Нельзя отменить после начала" });

    const foreign = await cancelUserRegistration(regId, otherId, "participant");
    expect(foreign).toEqual({ ok: false, error: "Forbidden" });
  });

  it("participant can cancel a free registration", async () => {
    const userId = await seedUser("free-cancel-user");
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 0 });
    const regId = await seedRegistration(userId, sessionId, "free");
    const result = await cancelUserRegistration(regId, userId, "participant");
    expect(result.ok).toBe(true);
  });

  it("public roster lists active registrations with anonymized labels", async () => {
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 0 });
    const visibleId = await seedUser("roster-visible");
    const hiddenId = await seedUser("roster-hidden");
    const emptyNameId = await seedUser("roster-empty");
    await db
      .update(user)
      .set({ name: "Иван Иванов", rosterNameVisible: true })
      .where(eq(user.id, visibleId));
    await db
      .update(user)
      .set({ name: "Secret Person", rosterNameVisible: false })
      .where(eq(user.id, hiddenId));
    await db
      .update(user)
      .set({ name: "   ", rosterNameVisible: true })
      .where(eq(user.id, emptyNameId));

    await seedRegistration(visibleId, sessionId, "free");
    await seedRegistration(hiddenId, sessionId, "free");
    await seedRegistration(emptyNameId, sessionId, "free");
    const cancelledUser = await seedUser("roster-cancelled");
    await seedRegistration(cancelledUser, sessionId, "free", "cancelled");

    const roster = await listPublicRoster(sessionId);
    expect(roster).toHaveLength(3);
    expect(roster.some((row) => row.label === "Иван Иванов")).toBe(true);
    expect(
      roster.filter((row) => row.label === PUBLIC_ROSTER_ANONYMOUS_LABEL),
    ).toHaveLength(2);
    expect(
      publicRosterLabel({ name: "Secret Person", rosterNameVisible: false }),
    ).toBe(PUBLIC_ROSTER_ANONYMOUS_LABEL);
  });
});
