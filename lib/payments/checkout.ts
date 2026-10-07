import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payments, registrations, trainingSessions } from "@/lib/db/schema";
import { getPaymentProviderId } from "@/lib/payments/config";

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

export async function ensurePaymentForRegistration(registrationId: string) {
  const row = await getRegistrationWithSession(registrationId);
  if (!row) {
    return { ok: false as const, error: "Запись не найдена" };
  }
  const { registration, session } = row;

  if (registration.status === "paid") {
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

  if (registration.status !== "pending_payment") {
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
  }

  return {
    ok: true as const,
    registration,
    session,
    payment,
    free: false,
  };
}
