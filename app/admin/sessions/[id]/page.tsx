import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminBanner,
  TrainingStatusBadge,
} from "@/components/admin/admin-badges";
import { AdminMenu } from "@/components/admin/admin-menu";
import { RefreshAt } from "@/components/admin/refresh-at";
import {
  CancelSessionDialog,
  RescheduleDialog,
} from "@/components/admin/session-dialogs";
import { SessionLiveRefresh } from "@/components/admin/session-live-refresh";
import { Muted, PageHeader } from "@/components/nl/ui";
import {
  cancelTrainingAction,
  rescheduleTrainingAction,
} from "@/lib/admin/session-actions";
import {
  DEFAULT_TRAINING_END_TIME,
  DEFAULT_TRAINING_GATHER_TIME,
} from "@/lib/admin/training-form-schedule";
import { defaultTrainingCancellationBody } from "@/lib/admin/training-session-copy";
import { can } from "@/lib/auth/capabilities";
import { getServerSession } from "@/lib/auth/session";
import { attendanceMoments } from "@/lib/domain/attendance/rules";
import { postPath } from "@/lib/feed/open-post-url";
import { isPostLive } from "@/lib/feed/publication";
import {
  formatDateInput,
  formatPriceRub,
  formatShortListDate,
  formatTimeHm,
  formatTimeInput,
  formatTimeRange,
} from "@/lib/format/datetime";
import { getAdminSession } from "@/lib/training/admin-queries";
import { trainingDisplayStatus } from "@/lib/training/status";
import { JournalTab } from "./journal-tab";
import { ListTab } from "./list-tab";
import { PostsTab } from "./posts-tab";
import { SettingsTab } from "./settings-tab";
import { parseFilter, parseTab, TABS, tabHref } from "./tabs";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    filter?: string;
    done?: string;
    error?: string;
    post?: string;
    count?: string;
  }>;
};

const DONE_MESSAGES: Record<string, (count: string | undefined) => string> = {
  created: () => "Тренировка создана.",
  saved: () => "Параметры сохранены.",
  rescheduled: () => "Тренировка перенесена.",
  cancelled: () =>
    "Тренировка отменена. Неоплаченные записи сняты; по оплатившим оформите возврат или перенос.",
  refunded: (n) => `Возврат оформлен: ${n ?? 0}.`,
  transferred: (n) => `Оплата перенесена: ${n ?? 0}.`,
};

export default async function AdminSessionPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const query = await searchParams;
  const [row, viewer] = await Promise.all([
    getAdminSession(id),
    getServerSession(),
  ]);
  if (!row) notFound();

  const { session, announcement } = row;
  const tab = parseTab(query.tab);
  const filter = parseFilter(query.filter);
  const now = new Date();
  const isCancelled = session.status === "cancelled";
  const displayStatus = trainingDisplayStatus({
    status: session.status,
    startsAt: session.startsAt,
    wasRescheduled: row.wasRescheduled,
    now,
  });
  const consequences = {
    active: row.taken,
    paid: row.paid,
    unpaid: row.unpaid,
    collectedLabel: formatPriceRub(row.collectedCents, session.currency),
  };

  return (
    <main>
      <PageHeader
        back={{ href: "/admin/sessions", label: "Расписание" }}
        title={session.title}
        meta={
          <>
            <span className="nl-mono data-sm nl-admin-session-head__when">
              {formatShortListDate(session.startsAt)} ·{" "}
              {formatTimeRange(session.startsAt, session.endsAt)}
              {session.gatherAt
                ? ` · сбор ${formatTimeHm(session.gatherAt)}`
                : ""}
            </span>
            <TrainingStatusBadge status={displayStatus} />
            <span className="nl-mono data-sm">
              Занято {row.taken}
              {session.capacity !== null ? ` из ${session.capacity}` : ""}
              {session.priceCents > 0
                ? ` · оплатили ${row.paidMoney} · ждут оплаты ${row.unpaid} · собрано ${consequences.collectedLabel}`
                : " · бесплатно"}
            </span>
            {isCancelled && session.cancellationReason ? (
              <Muted className="caption nl-admin-session-head__reason">
                Причина отмены: {session.cancellationReason}
              </Muted>
            ) : null}
          </>
        }
        actions={
          <>
            {announcement ? (
              <>
                {isPostLive(announcement, now) ? (
                  <Link
                    href={postPath(announcement.slug, "training_announcement")}
                    className="nl-button"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть на сайте
                  </Link>
                ) : null}
                <Link
                  href={`/admin/posts/${announcement.id}`}
                  className="nl-button"
                >
                  Анонс
                </Link>
              </>
            ) : (
              <Link
                href={`/admin/posts/new?session=${session.id}`}
                className="nl-button"
              >
                Создать анонс
              </Link>
            )}
            {!isCancelled ? (
              <AdminMenu label="Действия с тренировкой">
                <RescheduleDialog
                  inMenu
                  sessionId={session.id}
                  defaults={{
                    date: formatDateInput(session.startsAt),
                    gather: session.gatherAt
                      ? formatTimeInput(session.gatherAt)
                      : DEFAULT_TRAINING_GATHER_TIME,
                    start: formatTimeInput(session.startsAt),
                    end: session.endsAt
                      ? formatTimeInput(session.endsAt)
                      : DEFAULT_TRAINING_END_TIME,
                  }}
                  consequences={consequences}
                  action={rescheduleTrainingAction}
                />
                <CancelSessionDialog
                  sessionId={session.id}
                  defaultBody={defaultTrainingCancellationBody(
                    session.startsAt,
                  )}
                  consequences={consequences}
                  action={cancelTrainingAction}
                  triggerClassName="nl-admin-menu__item--danger"
                  inMenu
                />
              </AdminMenu>
            ) : null}
          </>
        }
      />

      {query.error ? (
        <AdminBanner tone="error">{query.error}</AdminBanner>
      ) : query.done && DONE_MESSAGES[query.done] ? (
        <AdminBanner tone="ok">
          {DONE_MESSAGES[query.done](query.count)}
          {query.post ? (
            <>
              {" "}
              <Link href={`/admin/posts/${query.post}`}>Открыть пост →</Link>
            </>
          ) : null}
        </AdminBanner>
      ) : null}

      <SessionLiveRefresh sessionId={session.id} />
      {/* Кнопки «Был / Не был», «Остальные не пришли» появляются и исчезают сами. */}
      <RefreshAt
        moments={attendanceMoments(session).map((m) => m.toISOString())}
        serverNow={now.toISOString()}
      />
      <nav className="nl-admin-tabs" aria-label="Разделы тренировки">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(session.id, t.key)}
            className="nl-admin-tabs__tab"
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "list" ? (
        <ListTab
          session={session}
          isCancelled={isCancelled}
          counts={row}
          filter={filter}
          attendanceLate={can(
            viewer?.user.role as string | undefined,
            "attendance.markLate",
          )}
        />
      ) : null}

      {tab === "settings" ? (
        isCancelled ? (
          <p className="caption">
            Тренировка отменена — параметры не меняются.
          </p>
        ) : (
          <SettingsTab session={session} />
        )
      ) : null}

      {tab === "posts" ? <PostsTab sessionId={session.id} /> : null}

      {tab === "journal" ? <JournalTab sessionId={session.id} /> : null}
    </main>
  );
}
