import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payments, registrations, trainingSessions } from "@/lib/db/schema";
import { getPaymentByRegistrationId } from "@/lib/payments/checkout";
import { getPaymentProviderId } from "@/lib/payments/config";
import { confirmPaymentSucceeded } from "@/lib/payments/confirm-payment";

export async function markRegistrationPaid(params: {
  registrationId: string;
  source: "admin_onsite" | "admin_mock";
  actorUserId: string;
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
  if (registration.status === "paid") {
    return { ok: true as const, already: true as const };
  }
  if (registration.status !== "pending_payment") {
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

  const result = await confirmPaymentSucceeded({
    paymentId: payment.id,
    provider: payment.provider,
    externalId: payment.externalId ?? undefined,
    webhookDeliveryId: `${params.source}-${params.actorUserId}-${Date.now()}`,
    webhookPayload: { source: params.source, userId: params.actorUserId },
  });
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  return { ok: true as const, already: false as const };
}
