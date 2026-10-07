import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { payments, registrations } from "@/lib/db/schema";
import {
  cancelUserRegistration,
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

  it("free session marks registration paid", async () => {
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
    expect(rows[0]?.status).toBe("paid");
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
    expect(rows[0]?.status).toBe("pending_payment");

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
  });

  it("blocks registration once the training has started", async () => {
    const userId = await seedUser("late-user");
    const { sessionId } = await seedPublishedAnnouncement({
      startsAt: new Date(Date.now() - 60_000),
    });
    const result = await registerUserForSession(userId, sessionId);
    expect(result).toEqual({ ok: false, error: "Тренировка уже началась" });
  });

  it("participant cannot cancel a paid registration, admin can", async () => {
    const userId = await seedUser("paid-cancel-user");
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 50000,
    });
    const regId = await seedRegistration(userId, sessionId, "paid");

    const self = await cancelUserRegistration(regId, userId, false);
    expect(self.ok).toBe(false);

    const byAdmin = await cancelUserRegistration(regId, "admin-id", true);
    expect(byAdmin.ok).toBe(true);
  });

  it("participant can cancel a free registration", async () => {
    const userId = await seedUser("free-cancel-user");
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 0 });
    const regId = await seedRegistration(userId, sessionId, "paid");
    const result = await cancelUserRegistration(regId, userId, false);
    expect(result.ok).toBe(true);
  });
});
