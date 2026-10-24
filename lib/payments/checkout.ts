import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payments, registrations, trainingSessions } from "@/lib/db/schema";
import { getPaymentProviderId } from "@/lib/payments/config";
import { resetPaymentForRetry } from "@/lib/payments/reset-payment";

export async function getRegistrationWithSession(registrationId: string) {
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
    .where(eq(registrations.id, registrationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPaymentByRegistrationId(registrationId: string) {
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.registrationId, registrationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function ensurePaymentForRegistration(
  registrationId: string,
  userId: string,
) {
  const row = await getRegistrationWithSession(registrationId);
  if (!row) {
    return { ok: false as const, error: "Запись не найдена" };
  }
  const { registration, session } = row;
  if (registration.userId !== userId) {
    return { ok: false as const, error: "Запись не найдена" };
  }

  if (
    registration.status === "active" &&
    registration.paymentState === "paid"
  ) {
    return {
      ok: true as const,
      registration,
      session,
      payment: null,
      free: false,
    };
  }

  if (session.priceCents <= 0) {
    return { ok: false as const, error: "Бесплатная запись без оплаты" };
  }

  if (!session.onlinePaymentEnabled) {
    return {
      ok: false as const,
      error: "Онлайн-оплата для этой тренировки отключена",
    };
  }

  if (registration.status !== "active" || registration.paymentState !== "due") {
    return { ok: false as const, error: "Запись недоступна для оплаты" };
  }

  let payment = await getPaymentByRegistrationId(registrationId);
  if (!payment) {
    const provider = getPaymentProviderId();
    const id = crypto.randomUUID();
    const externalId = `${provider}_${id.slice(0, 8)}`;
    await db.insert(payments).values({
      id,
      userId: registration.userId,
      registrationId: registration.id,
      amountCents: session.priceCents,
      currency: session.currency,
      status: "pending",
      provider,
      externalId,
    });
    const created = await getPaymentByRegistrationId(registrationId);
    if (!created) {
      return { ok: false as const, error: "Не удалось создать платёж" };
    }
    payment = created;
  } else if (payment.status !== "pending") {
    // Запись ждёт оплаты, а платёж остался от возврата или переноса
    // (строки, перезаписанные до частичного unique; см. reset-payment.ts).
    payment = await resetPaymentForRetry(db, payment, {
      amountCents: session.priceCents,
      currency: session.currency,
    });
  }

  return {
    ok: true as const,
    registration,
    session,
    payment,
    free: false,
  };
}
