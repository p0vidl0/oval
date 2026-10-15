import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";

export async function latestPaymentIdForRegistration(
  registrationId: string,
): Promise<string> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for payment helpers");
  }
  const [row] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.registrationId, registrationId))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (!row?.id) {
    throw new Error(`No payment for registration ${registrationId}`);
  }
  return row.id;
}
