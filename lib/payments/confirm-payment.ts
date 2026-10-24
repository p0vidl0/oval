import { and, eq } from "drizzle-orm";
import { recordServerEvent } from "@/lib/analytics/record-event";
import { db } from "@/lib/db/client";
import {
  payments,
  paymentWebhookDeliveries,
  registrations,
} from "@/lib/db/schema";
import { insertRegistrationEvents } from "@/lib/domain/registration/events";
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
  /** Кто подтвердил: webhook провайдера или админ («Оплачено на месте», mock). */
  source?: "webhook" | "admin_onsite" | "admin_mock";
  actorUserId?: string | null;
  /** Способ оплаты; без него остаётся тот, с которым создан платёж. */
  method?: "online" | "cash" | "bank_transfer";
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
        ...(params.method ? { method: params.method } : {}),
        externalId: params.externalId ?? payment.externalId,
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id));

    const updated = await tx
      .update(registrations)
      .set({ paymentState: "paid", updatedAt: now })
      .where(
        and(
          eq(registrations.id, payment.registrationId),
          eq(registrations.status, "active"),
          eq(registrations.paymentState, "due"),
        ),
      )
      .returning({ sessionId: registrations.trainingSessionId });
    if (updated[0]) {
      await insertRegistrationEvents(tx, [
        {
          registrationId: payment.registrationId,
          sessionId: updated[0].sessionId,
          kind: "payment_succeeded",
          payload: {
            paymentId: payment.id,
            amountCents: payment.amountCents,
            source: params.source ?? "webhook",
            method: params.method ?? payment.method,
          },
          actorUserId: params.actorUserId ?? null,
        },
      ]);
    }
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

  await recordServerEvent({
    name: "payment_success",
    path: `/cabinet/pay/${payment.registrationId}`,
    props: {
      paymentId: payment.id,
      registrationId: payment.registrationId,
      sessionId,
      amountCents: payment.amountCents,
    },
  });

  return { ok: true, alreadyProcessed: false, paymentId: payment.id };
}
