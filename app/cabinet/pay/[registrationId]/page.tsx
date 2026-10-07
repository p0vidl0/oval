import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NlShell } from "@/components/nl/shell";
import { NlStatus } from "@/components/nl/status";
import { getServerSession } from "@/lib/auth/session";
import { formatDateTimeRu, formatPriceRub } from "@/lib/format/datetime";
import { ensurePaymentForRegistration } from "@/lib/payments/checkout";

type Props = { params: Promise<{ registrationId: string }> };

export default async function CheckoutPage({ params }: Props) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login?next=/cabinet");
  }

  const { registrationId } = await params;
  const checkout = await ensurePaymentForRegistration(registrationId);
  if (!checkout.ok) {
    notFound();
  }

  const { registration, session: training, payment } = checkout;
  if (registration.userId !== session.user.id) {
    notFound();
  }

  if (registration.status === "paid") {
    redirect("/cabinet");
  }

  if (!payment) {
    redirect("/cabinet");
  }

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
          data-testid="checkout-title"
        >
          Оплата тренировки
        </h1>
        <dl
          className="nl-field"
          style={{ marginTop: "var(--space-6)", gap: "var(--space-3)" }}
        >
          <div>
            <dt className="nl-label">Тренировка</dt>
            <dd>{training.title}</dd>
          </div>
          <div>
            <dt className="nl-label">Когда</dt>
            <dd className="nl-mono data-sm">
              {formatDateTimeRu(training.startsAt)}
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
              {payment.status === "pending" ? (
                <NlStatus variant="due">
                  Ждёт оплаты ·{" "}
                  {formatPriceRub(payment.amountCents, payment.currency)}
                </NlStatus>
              ) : payment.status === "succeeded" ? (
                <NlStatus paid>Оплачено</NlStatus>
              ) : (
                payment.status
              )}
            </dd>
          </div>
        </dl>

        {payment.status === "pending" ? (
          <div
            className="nl-aside-card"
            style={{ marginTop: "var(--space-6)" }}
          >
            <p className="body-sm" style={{ color: "var(--ink-2)", margin: 0 }}>
              Место за вами. Онлайн-оплата пока недоступна — оплатите тренировку
              на месте у тренера, он отметит оплату.
            </p>
            <Link
              href="/cabinet"
              className="nl-button nl-button--block"
              style={{ marginTop: "var(--space-4)" }}
            >
              В кабинет
            </Link>
          </div>
        ) : null}

        {payment.status === "succeeded" ? (
          <Link
            href={`/cabinet/payments/${payment.id}`}
            className="nl-button nl-button--text"
            style={{ marginTop: "var(--space-6)" }}
          >
            Квитанция
          </Link>
        ) : null}
      </main>
    </NlShell>
  );
}
