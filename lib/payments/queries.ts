import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payments, registrations, trainingSessions } from "@/lib/db/schema";

export async function listUserPayments(userId: string) {
  return db
    .select({
      payment: payments,
      registration: registrations,
      session: trainingSessions,
    })
    .from(payments)
    .innerJoin(registrations, eq(payments.registrationId, registrations.id))
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt));
}

export async function getPaymentForUser(paymentId: string, userId: string) {
  const rows = await db
    .select({
      payment: payments,
      registration: registrations,
      session: trainingSessions,
    })
    .from(payments)
    .innerJoin(registrations, eq(payments.registrationId, registrations.id))
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .where(eq(payments.id, paymentId))
    .limit(1);
  const row = rows[0];
  if (!row || row.payment.userId !== userId) return null;
  return row;
}
