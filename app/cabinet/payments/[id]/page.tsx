import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NlShell } from "@/components/nl/shell";
import { NlStatus } from "@/components/nl/status";
import { getServerSession } from "@/lib/auth/session";
import { formatDateTimeRu, formatPriceRub } from "@/lib/format/datetime";
import { getPaymentForUser } from "@/lib/payments/queries";
import { paymentStatusLabel } from "@/lib/payments/status";

type Props = { params: Promise<{ id: string }> };

export default async function PaymentReceiptPage({ params }: Props) {
  const session = await getServerSession();
  if (!session) redirect("/login?next=/cabinet");

  const { id } = await params;
  const row = await getPaymentForUser(id, session.user.id);
  if (!row) notFound();

  const { payment, session: training } = row;

  return (
    <NlShell tab="cabinet">
      <main className="nl-page" style={{ maxWidth: 520 }}>
        <Link
          href="/cabinet"
          className="caption"
          style={{ color: "var(--ink-muted)" }}
        >
          ← Кабинет
        </Link>
        <h1
          className="nl-display"
          style={{ marginTop: "var(--space-4)", fontSize: 36 }}
        >
          Квитанция
        </h1>
        <dl
          className="nl-field"
          style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }}
        >
          <div>
            <dt className="nl-label">Тренировка</dt>
            <dd>
              {training.title} · {formatDateTimeRu(training.startsAt)}
            </dd>
          </div>
          <div>
            <dt className="nl-label">Сумма</dt>
            <dd className="nl-mono" style={{ fontSize: 20 }}>
              {formatPriceRub(payment.amountCents, payment.currency)}
            </dd>
          </div>
          <div>
            <dt className="nl-label">Статус</dt>
            <dd>
              <NlStatus
                paid={payment.status === "succeeded"}
                variant={payment.status === "pending" ? "due" : "default"}
              >
                {paymentStatusLabel(payment)}
              </NlStatus>
            </dd>
          </div>
          {payment.paidAt ? (
            <div>
              <dt className="nl-label">Дата оплаты</dt>
              <dd>{formatDateTimeRu(payment.paidAt)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="nl-label">Номер платежа</dt>
            <dd className="nl-mono data-sm">{payment.id}</dd>
          </div>
        </dl>
      </main>
    </NlShell>
  );
}
