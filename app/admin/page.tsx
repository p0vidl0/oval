import Link from "next/link";
import { TrainingStatusBadge } from "@/components/admin/admin-badges";
import { NlDateStack } from "@/components/nl/date-stack";
import {
  ListRow,
  ListRows,
  Muted,
  PageHeader,
  Section,
} from "@/components/nl/ui";
import { attendanceWindow, sessionEnd } from "@/lib/domain/attendance/rules";
import {
  formatPriceRub,
  formatShortListDate,
  formatTimeHm,
  formatTimeRange,
} from "@/lib/format/datetime";
import {
  type AdminSessionRow,
  listAttentionSessions,
  listCurrentAndNextSessions,
  listPaidOnCancelled,
  listUnpaid,
  unmarkedCount,
} from "@/lib/training/admin-queries";
import { trainingDisplayStatus } from "@/lib/training/status";

/** Данные на момент запроса: страницу нельзя собрать заранее при build. */
export const dynamic = "force-dynamic";

function sessionHref(id: string, filter?: string) {
  return `/admin/sessions/${id}${filter ? `?filter=${filter}` : ""}`;
}

/** «записано 12 из 18 · оплатили 9 · ждут 3» */
function countersLine(row: AdminSessionRow, now: Date) {
  const { session } = row;
  const parts = [
    `записано ${row.taken}${session.capacity !== null ? ` из ${session.capacity}` : ""}`,
  ];
  if (now >= attendanceWindow(session).opensAt) {
    parts.push(`отмечено ${row.marked} из ${row.taken}`);
  }
  if (session.priceCents > 0) {
    parts.push(`оплатили ${row.paidMoney}`);
    if (row.unpaid > 0) parts.push(`ждут оплаты ${row.unpaid}`);
    parts.push(
      `собрано ${formatPriceRub(row.collectedCents, session.currency)}`,
    );
  } else {
    parts.push("бесплатно");
  }
  return parts.join(" · ");
}

function hoursUntil(date: Date, now: Date) {
  return Math.max(1, Math.round((date.getTime() - now.getTime()) / 3600_000));
}

/** Прошедшая тренировка: пора закрыть список отметок. */
function isPastSession(row: AdminSessionRow, now: Date) {
  return sessionEnd(row.session) < now;
}

function attentionReason(row: AdminSessionRow, now: Date) {
  if (row.session.status === "cancelled") {
    return `Отменена, оплатили ${row.paidMoney} — нужен возврат или перенос`;
  }
  if (isPastSession(row, now)) {
    return `Не отмечено ${unmarkedCount(row)}`;
  }
  return `${row.unpaid} не оплатили, старт через ${hoursUntil(row.session.startsAt, now)} ч`;
}

function attentionFilter(row: AdminSessionRow, now: Date) {
  if (row.session.status === "cancelled") return "paid";
  return isPastSession(row, now) ? "unmarked" : "unpaid";
}

export default async function AdminTodayPage() {
  const now = new Date();
  const [sessions, attention, unpaid, refunds] = await Promise.all([
    listCurrentAndNextSessions(now),
    listAttentionSessions(now),
    listUnpaid({ page: 1, size: 1 }),
    listPaidOnCancelled({ page: 1, size: 1 }),
  ]);
  const [current, ...next] = sessions;

  return (
    <main>
      <PageHeader
        title="Сегодня"
        actions={
          <Link
            href="/admin/sessions/new"
            className="nl-button nl-button--primary"
          >
            Добавить тренировку
          </Link>
        }
      />

      {current ? (
        <article className="nl-card nl-admin-today">
          <NlDateStack date={current.session.startsAt} />
          <div className="nl-admin-today__body">
            <h2 className="nl-display nl-admin-today__title">
              {current.session.title}
            </h2>
            <p className="nl-mono nl-admin-today__time">
              {formatTimeRange(
                current.session.startsAt,
                current.session.endsAt,
              )}
              {current.session.startsAt <= now ? " · идёт сейчас" : ""}
            </p>
            <div className="nl-admin-today__meta">
              <TrainingStatusBadge
                status={trainingDisplayStatus({
                  status: current.session.status,
                  startsAt: current.session.startsAt,
                  wasRescheduled: current.wasRescheduled,
                  now,
                })}
              />
              <span className="nl-mono data-sm">
                {countersLine(current, now)}
              </span>
            </div>
            <div className="nl-admin-today__actions">
              <Link
                href={sessionHref(current.session.id)}
                className="nl-button nl-button--primary"
              >
                Открыть список
              </Link>
              {current.announcement ? (
                <Link
                  href={`/admin/posts/${current.announcement.id}`}
                  className="nl-button"
                >
                  Анонс
                </Link>
              ) : null}
            </div>
          </div>
        </article>
      ) : (
        <div className="nl-admin-callout">
          <p>Ближайших тренировок нет.</p>
        </div>
      )}

      <Section
        title="Требует внимания"
        aside={
          unpaid.total > 0 || refunds.total > 0 ? (
            <span className="caption nl-admin-today__links">
              <Link href="/admin/payments">Ждут оплаты ({unpaid.total})</Link>
              <Link href="/admin/payments?tab=refunds">
                Возвраты ({refunds.total})
              </Link>
            </span>
          ) : null
        }
      >
        {attention.length === 0 ? (
          <Muted as="p" className="caption">
            Всё в порядке.
          </Muted>
        ) : (
          <ListRows>
            {attention.map((row) => (
              <ListRow
                key={row.session.id}
                title={
                  <Link
                    href={sessionHref(
                      row.session.id,
                      attentionFilter(row, now),
                    )}
                  >
                    {row.session.title}
                  </Link>
                }
                meta={`${formatShortListDate(row.session.startsAt)} · ${formatTimeHm(row.session.startsAt)}`}
                aside={
                  <span className="nl-status nl-status--due">
                    {attentionReason(row, now)}
                  </span>
                }
              />
            ))}
          </ListRows>
        )}
      </Section>

      {next.length > 0 ? (
        <Section
          title="Дальше"
          aside={
            <Link href="/admin/sessions" className="caption">
              Всё расписание
            </Link>
          }
        >
          <ListRows>
            {next.map((row) => (
              <ListRow
                key={row.session.id}
                title={
                  <Link href={sessionHref(row.session.id)}>
                    {row.session.title}
                  </Link>
                }
                meta={`${formatShortListDate(row.session.startsAt)} · ${formatTimeHm(row.session.startsAt)}`}
                aside={
                  <span className="nl-mono data-sm">
                    {countersLine(row, now)}
                  </span>
                }
              />
            ))}
          </ListRows>
        </Section>
      ) : null}
    </main>
  );
}
