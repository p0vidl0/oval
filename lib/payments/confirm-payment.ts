import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  payments,
  paymentWebhookDeliveries,
  registrations,
} from "@/lib/db/schema";
import { publishSessionRegistrationsChanged } from "@/lib/realtime/publish-session-registrations-changed";

export type ConfirmPaymentResult =
  | { ok: true; alreadyProcessed: boolean; paymentId: string }
  | { ok: false; error: string };

/**
 * Idempotent: webhook retries and duplicate admin clicks are safe.
 */
export async function confirmPaymentSucceeded(params: {
  paymentId: string;
  provider: string;
  externalId?: string;
  webhookDeliveryId?: string;
  webhookPayload?: Record<string, unknown>;
}): Promise<ConfirmPaymentResult> {
  if (params.webhookDeliveryId) {
    const deliveryKey = `${params.provider}:${params.webhookDeliveryId}`;
    const existing = await db
      .select()
      .from(paymentWebhookDeliveries)
      .where(eq(paymentWebhookDeliveries.id, deliveryKey))
      .limit(1);
    if (existing[0]) {
      return {
        ok: true,
        alreadyProcessed: true,
        paymentId: existing[0].paymentId ?? params.paymentId,
      };
    }
  }

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.id, params.paymentId))
    .limit(1);
  const payment = paymentRows[0];
  if (!payment) {
    return { ok: false, error: "Payment not found" };
  }
  if (payment.provider !== params.provider) {
    return { ok: false, error: "Provider mismatch" };
  }

  if (payment.status === "succeeded") {
    return { ok: true, alreadyProcessed: true, paymentId: payment.id };
  }
  if (payment.status !== "pending") {
    return { ok: false, error: `Payment status is ${payment.status}` };
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    if (params.webhookDeliveryId) {
      const deliveryKey = `${params.provider}:${params.webhookDeliveryId}`;
      await tx.insert(paymentWebhookDeliveries).values({
        id: deliveryKey,
        provider: params.provider,
        paymentId: payment.id,
        payload: params.webhookPayload ?? {},
      });
    }

    await tx
      .update(payments)
      .set({
        status: "succeeded",
        paidAt: now,
        externalId: params.externalId ?? payment.externalId,
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id));

    await tx
      .update(registrations)
      .set({ status: "paid", updatedAt: now })
      .where(
        and(
          eq(registrations.id, payment.registrationId),
          eq(registrations.status, "pending_payment"),
        ),
      );
  });

  const regRows = await db
    .select({ sessionId: registrations.trainingSessionId })
    .from(registrations)
    .where(eq(registrations.id, payment.registrationId))
    .limit(1);
  const sessionId = regRows[0]?.sessionId;
  if (sessionId) {
    await publishSessionRegistrationsChanged(sessionId);
  }

  return { ok: true, alreadyProcessed: false, paymentId: payment.id };
}
