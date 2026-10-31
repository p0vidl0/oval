import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/app/cabinet/sign-out-button";
import { AuthMethodsPanel } from "@/components/cabinet/auth-methods-panel";
import { CabinetProfileForm } from "@/components/cabinet/profile-form";
import { CancelRegistrationForm } from "@/components/nl/cancel-registration-form";
import { NlDateStack } from "@/components/nl/date-stack";
import { NlShell } from "@/components/nl/shell";
import { NlStatus } from "@/components/nl/status";
import { Muted } from "@/components/nl/ui";
import {
  listAvailableProvidersToLink,
  listLinkedAuthMethods,
} from "@/lib/auth/linked-accounts";
import { getServerSession } from "@/lib/auth/session";
import { isTelegramBotLoginConfigured } from "@/lib/auth/telegram/config";
import { isTelegramOidcConfigured } from "@/lib/auth/telegram/oidc-config";
import { isVkConfigured } from "@/lib/auth/vk/config";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema/auth-schema";
import { describeRegistration } from "@/lib/domain/registration/describe";
import { PAID_CANCEL_MESSAGE } from "@/lib/domain/registration/types";
import { postPath } from "@/lib/feed/open-post-url";
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
  countUserAttendance,
  getTransferTargetsBySourceRegistrationIds,
  listUserRegistrationHistory,
  listUserRegistrations,
} from "@/lib/training/registrations";

function trainingsCountLabel(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "тренировка"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "тренировки"
        : "тренировок";
  return `${n} ${word}`;
}

type Props = {
  searchParams: Promise<{
    history?: string;
    error?: string;
    link?: string;
    linkToken?: string;
    linkError?: string;
  }>;
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

  const profileRows = await db
    .select({ rosterNameVisible: user.rosterNameVisible })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  const rosterNameVisible = profileRows[0]?.rosterNameVisible ?? true;

  const linkedMethods = await listLinkedAuthMethods(session.user.id);
  let availableProviders = listAvailableProvidersToLink(linkedMethods);
  if (!isVkConfigured()) {
    availableProviders = availableProviders.filter((p) => p !== "vk");
  }
  if (!isTelegramOidcConfigured() && !isTelegramBotLoginConfigured()) {
    availableProviders = availableProviders.filter((p) => p !== "telegram");
  }

  let linkNotice: string | null = null;
  if (params.link === "ok") {
    linkNotice = "Способ входа добавлен.";
  } else if (params.link === "merged") {
    linkNotice = "Аккаунты объединены.";
  } else if (params.linkError) {
    linkNotice = params.linkError;
  }

  const mergeLinkToken =
    params.link === "merge" && params.linkToken ? params.linkToken : null;

  const registrations = await listUserRegistrations(session.user.id);
  const history = await listUserRegistrationHistory(session.user.id);
  const year = new Date().getFullYear();
  const attendedThisYear = await countUserAttendance(session.user.id, year);
  const payments = await listUserPayments(session.user.id);
  const now = new Date();

  const upcoming = registrations.filter(
    (r) => r.session.startsAt >= now && r.session.status === "scheduled",
  );
  const past = history.filter(
    (r) =>
      r.session.startsAt < now ||
      r.session.status !== "scheduled" ||
      r.registration.status !== "active",
  );
  past.sort(
    (a, b) =>
      b.session.startsAt.getTime() - a.session.startsAt.getTime() ||
      b.registration.createdAt.getTime() - a.registration.createdAt.getTime(),
  );
  const historyVisible = showAllHistory ? past : past.slice(0, 5);

  const sessionIds = upcoming.map(({ session: training }) => training.id);
  const previousStartBySession =
    await getPreviousStartByRescheduledSessions(sessionIds);

  const transferredIds = past
    .filter(({ registration }) => registration.paymentState === "moved")
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
                      announcementPostSlug,
                    }) => {
                      const view = describeRegistration({
                        registration,
                        session: training,
                        viewer: "participant",
                        now,
                      });
                      const paid = registration.paymentState === "paid";
                      const free = registration.paymentState === "free";
                      const due = registration.paymentState === "due";
                      const showPay = view.actions.payOnline;
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
                              {announcementPostSlug ? (
                                <Link
                                  href={postPath(announcementPostSlug)}
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
                              {paid ? (
                                <NlStatus paid>Оплачено · {price}</NlStatus>
                              ) : free ? (
                                <NlStatus>Вы записаны</NlStatus>
                              ) : due ? (
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
                              {view.actions.cancel ? (
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
                              ) : paid ? (
                                <p className="caption nl-cabinet-booking__hint">
                                  {PAID_CANCEL_MESSAGE}
                                </p>
                              ) : null}
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
              {attendedThisYear > 0 ? (
                <Muted as="p" className="caption">
                  {trainingsCountLabel(attendedThisYear)} в {year}
                </Muted>
              ) : null}
              {past.length === 0 ? (
                <p className="nl-cabinet-empty">—</p>
              ) : (
                <div className="nl-cabinet-panel">
                  <ul className="nl-cabinet-history">
                    {historyVisible.map(
                      ({
                        registration,
                        session: training,
                        announcementPostSlug,
                      }) => {
                        const price = formatPriceRub(
                          training.priceCents,
                          training.currency,
                        );
                        const status = describeRegistration({
                          registration,
                          session: training,
                          viewer: "participant",
                          now,
                          transferTargetDate: transferTargetByRegId.get(
                            registration.id,
                          ),
                        });
                        const cancelled = !status.active;
                        const priceSuffix =
                          status.active &&
                          (registration.paymentState === "paid" ||
                            registration.paymentState === "due")
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
                              {announcementPostSlug ? (
                                <Link
                                  href={postPath(announcementPostSlug)}
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
                              {status.label}
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
                <CabinetProfileForm
                  name={session.user.name ?? ""}
                  email={session.user.email?.trim() || "Email не указан"}
                  rosterNameVisible={rosterNameVisible}
                />
              </div>
            </section>

            <section className="nl-cabinet-section">
              <AuthMethodsPanel
                linked={linkedMethods}
                available={availableProviders}
                mergeLinkToken={mergeLinkToken}
                linkNotice={linkNotice}
                telegramOidcConfigured={isTelegramOidcConfigured()}
                telegramBotConfigured={isTelegramBotLoginConfigured()}
              />
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
