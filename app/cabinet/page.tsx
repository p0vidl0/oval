import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/app/cabinet/sign-out-button";
import { CancelRegistrationForm } from "@/components/nl/cancel-registration-form";
import { NlDateStack } from "@/components/nl/date-stack";
import { NlShell } from "@/components/nl/shell";
import { NlStatus } from "@/components/nl/status";
import { getServerSession } from "@/lib/auth/session";
import { historyStatus } from "@/lib/cabinet/history-status";
import { updateProfileName } from "@/lib/cabinet/profile-actions";
import { getPreviousStartByRescheduledSessions } from "@/lib/feed/queries";
import {
  formatPriceRub,
  formatShortListDate,
  formatTimeHm,
  formatTimeRange,
} from "@/lib/format/datetime";
import { listUserPayments } from "@/lib/payments/queries";
import { paymentStatusLabel } from "@/lib/payments/status";
import {
  getTransferTargetsBySourceRegistrationIds,
  listUserRegistrationHistory,
  listUserRegistrations,
} from "@/lib/training/registrations";
import {
  canUserCancelRegistration,
  isClosedRegistrationStatus,
  PAID_CANCEL_MESSAGE,
} from "@/lib/training/status";

type Props = {
  searchParams: Promise<{ history?: string; error?: string }>;
};

function displayShortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Участник";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

export default async function CabinetPage({ searchParams }: Props) {
  const params = await searchParams;
  const showAllHistory = params.history === "all";

  const session = await getServerSession();
  if (!session) {
    redirect("/login?next=/cabinet");
  }

  const displayName = session.user.name?.trim() || "Участник";
  const mobileTitle = displayShortName(displayName);

  const registrations = await listUserRegistrations(session.user.id);
  const history = await listUserRegistrationHistory(session.user.id);
  const payments = await listUserPayments(session.user.id);
  const now = new Date();

  const upcoming = registrations.filter(
    (r) => r.session.startsAt >= now && r.session.status === "scheduled",
  );
  const past = history.filter(
    (r) =>
      r.session.startsAt < now ||
      r.session.status !== "scheduled" ||
      isClosedRegistrationStatus(r.registration.status),
  );
  past.sort(
    (a, b) => b.session.startsAt.getTime() - a.session.startsAt.getTime(),
  );
  const historyVisible = showAllHistory ? past : past.slice(0, 5);

  const sessionIds = upcoming.map(({ session: training }) => training.id);
  const previousStartBySession =
    await getPreviousStartByRescheduledSessions(sessionIds);

  const transferredIds = past
    .filter(({ registration }) => registration.status === "transferred")
    .map(({ registration }) => registration.id);
  const transferTargetByRegId =
    await getTransferTargetsBySourceRegistrationIds(transferredIds);

  return (
    <NlShell tab="cabinet">
      <main className="nl-page">
        <h1 className="nl-page-title nl-page-title--cabinet-desktop">
          Личный кабинет
        </h1>
        <h1 className="nl-page-title nl-page-title--cabinet-mobile">
          {mobileTitle}
        </h1>
        {params.error ? (
          <p
            className="caption"
            role="alert"
            style={{ color: "var(--cancel)" }}
          >
            {params.error}
          </p>
        ) : null}

        <div className="nl-cabinet-layout">
          <div className="nl-cabinet-main">
            <section className="nl-cabinet-section">
              <h2 className="nl-display nl-cabinet-section__title">
                Ближайшие записи
              </h2>
              {upcoming.length === 0 ? (
                <p className="nl-cabinet-empty">Нет записей</p>
              ) : (
                <ul className="nl-cabinet-booking-list">
                  {upcoming.map(
                    ({
                      registration,
                      session: training,
                      announcementPostId,
                    }) => {
                      const paid = registration.status === "paid";
                      const pending = registration.status === "pending_payment";
                      const showPay =
                        pending &&
                        training.priceCents > 0 &&
                        training.onlinePaymentEnabled;
                      const price = formatPriceRub(
                        training.priceCents,
                        training.currency,
                      );
                      const previousStart = previousStartBySession.get(
                        training.id,
                      );
                      return (
                        <li
                          key={registration.id}
                          className="nl-card nl-cabinet-booking"
                        >
                          <div className="nl-cabinet-booking__inner">
                            <NlDateStack date={training.startsAt} size="sm" />
                            <div className="nl-cabinet-booking__content">
                              {announcementPostId ? (
                                <Link
                                  href={`/feed/${announcementPostId}`}
                                  className="nl-display nl-cabinet-booking__title"
                                >
                                  {training.title}
                                </Link>
                              ) : (
                                <span className="nl-display nl-cabinet-booking__title">
                                  {training.title}
                                </span>
                              )}
                              <div className="nl-cabinet-booking__time-row">
                                <span className="nl-mono">
                                  {formatTimeRange(
                                    training.startsAt,
                                    training.endsAt,
                                  )}
                                </span>
                                {previousStart ? (
                                  <span className="nl-tag nl-tag--plain">
                                    перенос с {formatTimeHm(previousStart)}
                                  </span>
                                ) : null}
                              </div>
                              {paid && training.priceCents > 0 ? (
                                <NlStatus paid>Оплачено · {price}</NlStatus>
                              ) : paid ? (
                                <NlStatus>Вы записаны</NlStatus>
                              ) : pending && training.priceCents > 0 ? (
                                <NlStatus variant="due">
                                  Ждёт оплаты · {price}
                                </NlStatus>
                              ) : null}
                            </div>
                            <div className="nl-cabinet-booking__actions">
                              {showPay ? (
                                <Link
                                  href={`/cabinet/pay/${registration.id}`}
                                  className="nl-button nl-button--primary nl-button--block"
                                >
                                  Оплатить {price}
                                </Link>
                              ) : null}
                              {canUserCancelRegistration(
                                registration,
                                training,
                              ) ? (
                                <CancelRegistrationForm
                                  registrationId={registration.id}
                                  returnTo="/cabinet"
                                  className="nl-button nl-button--block nl-cancel-reg"
                                >
                                  <span className="nl-cancel-reg__long">
                                    Отменить запись
                                  </span>
                                  <span className="nl-cancel-reg__short">
                                    Отменить
                                  </span>
                                </CancelRegistrationForm>
                              ) : (
                                <p className="caption nl-cabinet-booking__hint">
                                  {PAID_CANCEL_MESSAGE}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    },
                  )}
                </ul>
              )}
            </section>

            <section id="history" className="nl-cabinet-section">
              <h2 className="nl-display nl-cabinet-section__title">История</h2>
              {past.length === 0 ? (
                <p className="nl-cabinet-empty">—</p>
              ) : (
                <div className="nl-cabinet-panel">
                  <ul className="nl-cabinet-history">
                    {historyVisible.map(
                      ({
                        registration,
                        session: training,
                        announcementPostId,
                      }) => {
                        const price = formatPriceRub(
                          training.priceCents,
                          training.currency,
                        );
                        const status = historyStatus({
                          registration,
                          transferTargetDate: transferTargetByRegId.get(
                            registration.id,
                          ),
                        });
                        const cancelled = isClosedRegistrationStatus(
                          registration.status,
                        );
                        const priceSuffix =
                          registration.status === "paid" &&
                          training.priceCents > 0
                            ? ` · ${price}`
                            : registration.status === "pending_payment" &&
                                training.priceCents > 0
                              ? ` · ${price}`
                              : "";

                        return (
                          <li
                            key={registration.id}
                            className={`nl-cabinet-history__row${cancelled ? " nl-cabinet-history__row--cancelled" : ""}`}
                          >
                            <div className="nl-cabinet-history__main">
                              <span className="nl-cabinet-history__date">
                                {formatShortListDate(training.startsAt)}
                              </span>
                              {announcementPostId ? (
                                <Link
                                  href={`/feed/${announcementPostId}`}
                                  className="nl-cabinet-history__title"
                                >
                                  {training.title}
                                </Link>
                              ) : (
                                <span className="nl-cabinet-history__title">
                                  {training.title}
                                </span>
                              )}
                            </div>
                            <NlStatus variant={status.variant}>
                              {status.text}
                              {priceSuffix}
                            </NlStatus>
                          </li>
                        );
                      },
                    )}
                  </ul>
                  {!showAllHistory && past.length > 5 ? (
                    <Link
                      href="/cabinet?history=all#history"
                      className="nl-button nl-button--block nl-cabinet-history__more"
                    >
                      Вся история
                    </Link>
                  ) : null}
                </div>
              )}
            </section>
          </div>

          <aside className="nl-cabinet-aside">
            <section className="nl-cabinet-section">
              <h2 className="nl-display nl-cabinet-section__title">Профиль</h2>
              <div className="nl-aside-card nl-cabinet-profile-card">
                <form action={updateProfileName} className="nl-field">
                  <label className="nl-label" htmlFor="profile-name">
                    Имя и фамилия
                    <input
                      id="profile-name"
                      name="name"
                      className="nl-input"
                      defaultValue={session.user.name ?? ""}
                    />
                  </label>
                  <p className="nl-field nl-cabinet-profile-card__email">
                    <span className="nl-label">
                      <span className="nl-show-desktop">Email для входа</span>
                      <span className="nl-show-mobile">Email</span>
                    </span>
                    <span className="nl-input nl-input--mono nl-cabinet-profile-card__email-value">
                      {session.user.email?.trim() || "Email не указан"}
                    </span>
                  </p>
                  <button
                    type="submit"
                    className="nl-button nl-button--primary nl-button--block"
                  >
                    Сохранить
                  </button>
                </form>
              </div>
            </section>

            {payments.length > 0 ? (
              <section className="nl-cabinet-section nl-cabinet-section--compact">
                <h2 className="caption" style={{ fontWeight: 700 }}>
                  Платежи
                </h2>
                <ul className="caption nl-cabinet-payments">
                  {payments.map(({ payment, session: training }) => (
                    <li key={payment.id}>
                      <Link href={`/cabinet/payments/${payment.id}`}>
                        {formatShortListDate(training.startsAt)} ·{" "}
                        {formatPriceRub(payment.amountCents, payment.currency)}{" "}
                        · {paymentStatusLabel(payment)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <SignOutButton />
          </aside>
        </div>
      </main>
    </NlShell>
  );
}
