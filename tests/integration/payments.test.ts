import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { payments, registrations } from "@/lib/db/schema";
import { ensurePaymentForRegistration } from "@/lib/payments/checkout";
import { confirmPaymentSucceeded } from "@/lib/payments/confirm-payment";
import {
  seedPendingPayment,
  seedPublishedAnnouncement,
  seedRegistration,
  seedUser,
} from "./helpers/seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("payments", () => {
  useIntegrationDb();

  it("ensurePaymentForRegistration creates pending payment", async () => {
    const userId = await seedUser("pay-user-1");
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 25000,
    });
    const regId = await seedRegistration(userId, sessionId);
    const ensured = await ensurePaymentForRegistration(regId);
    expect(ensured.ok).toBe(true);
    if (!ensured.ok || !ensured.payment) return;
    expect(ensured.payment.amountCents).toBe(25000);
    expect(ensured.payment.status).toBe("pending");
  });

  it("confirmPaymentSucceeded updates registration and is idempotent", async () => {
    const userId = await seedUser("pay-user-2");
    const { sessionId } = await seedPublishedAnnouncement({
      priceCents: 10000,
    });
    const regId = await seedRegistration(userId, sessionId);
    const paymentId = await seedPendingPayment(userId, regId, 10000);

    const first = await confirmPaymentSucceeded({
      paymentId,
      provider: "mock",
      webhookDeliveryId: "evt-1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.alreadyProcessed).toBe(false);

    const reg = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, regId));
    expect(reg[0]?.status).toBe("paid");

    const second = await confirmPaymentSucceeded({
      paymentId,
      provider: "mock",
      webhookDeliveryId: "evt-1",
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.alreadyProcessed).toBe(true);
    }
  });

  it("rejects provider mismatch", async () => {
    const userId = await seedUser("pay-user-3");
    const { sessionId } = await seedPublishedAnnouncement({ priceCents: 1000 });
    const regId = await seedRegistration(userId, sessionId);
    const paymentId = await seedPendingPayment(userId, regId, 1000);
    const result = await confirmPaymentSucceeded({
      paymentId,
      provider: "other",
    });
    expect(result.ok).toBe(false);
    const pay = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));
    expect(pay[0]?.status).toBe("pending");
  });
});
