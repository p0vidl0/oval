import { eq } from "drizzle-orm";
import type { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { getPaymentProviderId } from "@/lib/payments/config";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;
type Payment = typeof payments.$inferSelect;

/**
 * Один платёж на запись (`payments.registration_id` unique). Повторная запись
 * теперь создаёт новую строку, но строки, перезаписанные до частичного unique,
 * могут ждать оплаты со старым платежом от возврата или переноса: такой платёж
 * возвращается в `pending` под текущую цену, прежнее состояние — в
 * `metadata.previous`. Уйдёт вместе с попытками оплаты (шаг 5).
 */
export async function resetPaymentForRetry(
  executor: Executor,
  payment: Payment,
  price: { amountCents: number; currency: string },
): Promise<Payment> {
  const metadata = payment.metadata ?? {};
  const previous = Array.isArray(metadata.previous) ? metadata.previous : [];
  const { previous: _ignored, ...rest } = metadata;
  const provider = getPaymentProviderId();
  const now = new Date();
  const values = {
    status: "pending" as const,
    provider,
    externalId: `${provider}_${crypto.randomUUID().slice(0, 8)}`,
    amountCents: price.amountCents,
    currency: price.currency,
    paidAt: null,
    metadata: {
      previous: [
        ...previous,
        {
          ...rest,
          status: payment.status,
          provider: payment.provider,
          externalId: payment.externalId,
          amountCents: payment.amountCents,
          currency: payment.currency,
          paidAt: payment.paidAt?.toISOString() ?? null,
          resetAt: now.toISOString(),
        },
      ],
    },
    updatedAt: now,
  };
  await executor
    .update(payments)
    .set(values)
    .where(eq(payments.id, payment.id));
  return { ...payment, ...values };
}
