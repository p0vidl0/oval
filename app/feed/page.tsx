import Link from "next/link";
import { FeedLiveList } from "@/components/nl/feed-live-list";
import { FilterNav } from "@/components/nl/filter-nav";
import { NlShell } from "@/components/nl/shell";
import {
  type UpcomingItem,
  UpcomingStrip,
} from "@/components/nl/upcoming-strip";
import { getServerSession } from "@/lib/auth/session";
import { FEED_FILTERS, type FeedFilterKey } from "@/lib/feed/filter";
import { loadFeedLiveCards } from "@/lib/feed/load-feed-live-cards";
import { listUpcomingScheduledSessions } from "@/lib/feed/queries";
import { formatShortListDate, formatTimeHm } from "@/lib/format/datetime";
import { listUserRegistrations } from "@/lib/training/registrations";

function feedFilterHref(key: FeedFilterKey) {
  return key === "all" ? "/feed" : `/feed?filter=${key}`;
}

type Props = {
  searchParams: Promise<{ filter?: string }>;
};

function registrationStatusText(
  registration: { status: string },
  training: { priceCents: number; onlinePaymentEnabled: boolean },
) {
  if (registration.status === "paid") {
    return training.priceCents > 0 ? "Оплачено" : "Вы записаны";
  }
  return training.onlinePaymentEnabled ? "Ждёт оплаты" : "Оплата на месте";
}

/** Ближайшие тренировки + свои записи (даже если их нет в первых шести). */
function buildUpcomingItems(
  upcoming: Awaited<ReturnType<typeof listUpcomingScheduledSessions>>,
  myRegs: Awaited<ReturnType<typeof listUserRegistrations>>,
): UpcomingItem[] {
  const now = new Date();
  const mine = new Map(myRegs.map((r) => [r.session.id, r]));
  const items = new Map<string, UpcomingItem>();
  for (const { session: tr, post } of upcoming) {
    const reg = mine.get(tr.id);
    items.set(tr.id, {
      sessionId: tr.id,
      href: `/feed/${post.id}`,
      startsAt: tr.startsAt,
      title: tr.title,
      status: reg
        ? registrationStatusText(reg.registration, tr)
        : tr.registrationEnabled
          ? "запись открыта"
          : "запись закрыта",
      tone: reg ? "mine" : tr.registrationEnabled ? "open" : "muted",
    });
  }
  for (const { registration, session: tr, announcementPostId } of myRegs) {
    if (items.has(tr.id) || tr.startsAt < now || tr.status !== "scheduled") {
      continue;
    }
    items.set(tr.id, {
      sessionId: tr.id,
      href: announcementPostId ? `/feed/${announcementPostId}` : "/cabinet",
      startsAt: tr.startsAt,
      title: tr.title,
      status: registrationStatusText(registration, tr),
      tone: "mine",
    });
  }
  return [...items.values()].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}

export default async function FeedPage({ searchParams }: Props) {
  const params = await searchParams;
  const filter = (params.filter as FeedFilterKey | undefined) ?? "all";
  const session = await getServerSession();
  const initialCards = await loadFeedLiveCards(filter);
  const myRegs = session ? await listUserRegistrations(session.user.id) : [];
  const upcomingWeek = await listUpcomingScheduledSessions(6);
  const upcomingItems = buildUpcomingItems(upcomingWeek, myRegs);

  return (
    <NlShell tab="feed">
      <main className="nl-page">
        <p className="nl-page-lead nl-show-desktop">
          Анонсы вечерних тренировок на велотреке, новости, соревнования.
        </p>

        <FilterNav
          label="Тип публикаций"
          value={feedFilterHref(filter)}
          options={FEED_FILTERS.map((f) => ({
            href: feedFilterHref(f.key),
            label: f.label,
          }))}
        />

        <div className="nl-show-mobile">
          {!session ? (
            <div className="nl-login-prompt">
              <p className="body-sm" style={{ margin: 0 }}>
                Войдите, чтобы записываться на тренировки
              </p>
              <Link
                href="/login?next=/feed"
                className="nl-button nl-button--primary nl-button--sm"
              >
                Войти
              </Link>
            </div>
          ) : null}
          <UpcomingStrip items={upcomingItems} />
        </div>

        <div className="nl-feed-layout">
          <div className="nl-feed-main">
            <FeedLiveList
              initialCards={initialCards}
              filter={filter}
              isLoggedIn={Boolean(session)}
              needsName={Boolean(session) && !session?.user.name?.trim()}
            />
          </div>

          <aside className="nl-feed-aside">
            {!session ? (
              <div className="nl-aside-card">
                <h2>Хотите на трек?</h2>
                <p className="body-sm" style={{ color: "var(--ink-2)" }}>
                  Войдите, чтобы занять место на тренировке. Читать ленту можно
                  без входа.
                </p>
                <Link
                  href="/login?next=/feed"
                  className="nl-button nl-button--primary nl-button--block"
                  style={{ marginTop: "var(--space-4)" }}
                >
                  Войти
                </Link>
              </div>
            ) : null}

            {session && myRegs.length > 0 ? (
              <div className="nl-aside-card">
                <h2>Мои записи</h2>
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                  }}
                >
                  {myRegs
                    .slice(0, 4)
                    .map(
                      ({ registration, session: tr, announcementPostId }) => (
                        <li key={registration.id} className="nl-mono data-sm">
                          <Link
                            href={
                              announcementPostId
                                ? `/feed/${announcementPostId}`
                                : "/cabinet"
                            }
                            className="nl-aside-link"
                            style={{ color: "var(--ink)" }}
                          >
                            {formatShortListDate(tr.startsAt)} ·{" "}
                            {formatTimeHm(tr.startsAt)}
                            <span
                              style={{
                                display: "block",
                                color: "var(--ink-muted)",
                                fontSize: 13,
                              }}
                            >
                              {registration.status === "paid"
                                ? tr.priceCents > 0
                                  ? "Оплачено"
                                  : "Вы записаны"
                                : tr.onlinePaymentEnabled
                                  ? "Ждёт оплаты"
                                  : "Оплата на месте"}
                            </span>
                          </Link>
                        </li>
                      ),
                    )}
                </ul>
              </div>
            ) : null}

            <div className="nl-aside-card">
              <h2>Ближайшие</h2>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  fontSize: 14,
                  color: "var(--ink-2)",
                }}
              >
                {upcomingWeek.map(({ session: tr, post }) => (
                  <li key={tr.id} style={{ marginBottom: "var(--space-2)" }}>
                    <Link href={`/feed/${post.id}`} className="nl-aside-link">
                      {formatShortListDate(tr.startsAt)} ·{" "}
                      {formatTimeHm(tr.startsAt)}
                      {tr.status === "cancelled" ? (
                        <span style={{ color: "var(--cancel)" }}>
                          {" "}
                          · отменена
                        </span>
                      ) : tr.registrationEnabled ? (
                        <span style={{ color: "var(--signal)" }}>
                          {" "}
                          · запись открыта
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </NlShell>
  );
}
