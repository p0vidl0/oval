import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payments, registrations, trainingSessions } from "@/lib/db/schema";
import { getPaymentByRegistrationId } from "@/lib/payments/checkout";
import { getPaymentProviderId } from "@/lib/payments/config";
import { confirmPaymentSucceeded } from "@/lib/payments/confirm-payment";
import { resetPaymentForRetry } from "@/lib/payments/reset-payment";

/** Наличные или перевод тренеру — «Оплачено» в админке. */
export type OnsitePaymentMethod = "cash" | "bank_transfer";

export async function markRegistrationPaid(params: {
  registrationId: string;
  source: "admin_onsite" | "admin_mock";
  actorUserId: string;
  /** Для `admin_onsite`; mock-подтверждение считается онлайн-оплатой. */
  method?: OnsitePaymentMethod;
}) {
  const rows = await db
    .select({
      registration: registrations,
      session: trainingSessions,
    })
    .from(registrations)
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .where(eq(registrations.id, params.registrationId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { ok: false as const, error: "Запись не найдена" };
  }
  const { registration, session } = row;
  if (
    registration.status === "active" &&
    registration.paymentState === "paid"
  ) {
    return { ok: true as const, already: true as const };
  }
  if (registration.status !== "active" || registration.paymentState !== "due") {
    return { ok: false as const, error: "Запись недоступна для оплаты" };
  }
  if (session.priceCents <= 0) {
    return { ok: false as const, error: "Бесплатная запись" };
  }

  let payment = await getPaymentByRegistrationId(registration.id);
  if (!payment) {
    const provider = getPaymentProviderId();
    const id = crypto.randomUUID();
    await db.insert(payments).values({
      id,
      userId: registration.userId,
      registrationId: registration.id,
      amountCents: session.priceCents,
      currency: session.currency,
      status: "pending",
      provider,
      externalId: `${provider}_${id.slice(0, 8)}`,
      metadata: { source: params.source },
    });
    payment = await getPaymentByRegistrationId(registration.id);
  }
  if (!payment) {
    return { ok: false as const, error: "Не удалось создать платёж" };
  }
  if (payment.status !== "pending") {
    // Запись ждёт оплаты, а платёж остался от возврата или переноса.
    payment = await resetPaymentForRetry(db, payment, {
      amountCents: session.priceCents,
      currency: session.currency,
    });
  }

  const result = await confirmPaymentSucceeded({
    paymentId: payment.id,
    provider: payment.provider,
    externalId: payment.externalId ?? undefined,
    webhookDeliveryId: `${params.source}-${params.actorUserId}-${Date.now()}`,
    webhookPayload: { source: params.source, userId: params.actorUserId },
    source: params.source,
    actorUserId: params.actorUserId,
    method:
      params.source === "admin_onsite" ? (params.method ?? "cash") : "online",
  });
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  return { ok: true as const, already: false as const };
}
