import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminBanner,
  PostStatusBadge,
  TrainingStatusBadge,
} from "@/components/admin/admin-badges";
import {
  CancelSessionDialog,
  RefundAllForm,
  RescheduleDialog,
  TransferAllDialog,
} from "@/components/admin/session-dialogs";
import { SessionParticipantsTable } from "@/components/admin/session-participants";
import { TrainingFields } from "@/components/admin/training-fields";
import { FilterNav } from "@/components/nl/filter-nav";
import {
  cancelTrainingAction,
  refundAllPaidAction,
  rescheduleTrainingAction,
  transferAllPaidAction,
  updateTrainingSettingsAction,
} from "@/lib/admin/session-actions";
import {
  DEFAULT_TRAINING_END_TIME,
  DEFAULT_TRAINING_GATHER_TIME,
} from "@/lib/admin/training-form-schedule";
import { defaultTrainingCancellationBody } from "@/lib/admin/training-session-copy";
import { isPostLive } from "@/lib/feed/publication";
import { listPostsForSession } from "@/lib/feed/queries";
import { FEED_POST_TYPE_LABELS } from "@/lib/feed/types";
import {
  formatDateInput,
  formatDateTimeRu,
  formatPriceRub,
  formatShortListDate,
  formatTimeHm,
  formatTimeInput,
  formatTimeRange,
} from "@/lib/format/datetime";
import {
  getAdminSession,
  listSessionEvents,
  listSessionRegistrationsAdmin,
  listTransferTargets,
  PARTICIPANTS_FILTERS,
  type ParticipantsFilter,
} from "@/lib/training/admin-queries";
import { canEditScheduleDirectly } from "@/lib/training/session-service";
import { trainingDisplayStatus } from "@/lib/training/status";

type Tab = "participants" | "settings" | "history";

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

const TABS: { key: Tab; label: string }[] = [
  { key: "participants", label: "Участники" },
  { key: "settings", label: "Параметры" },
  { key: "history", label: "История" },
];

const DONE_MESSAGES: Record<string, (count: string | undefined) => string> = {
  created: () => "Тренировка создана.",
  saved: () => "Параметры сохранены.",
  rescheduled: () => "Тренировка перенесена.",
  cancelled: () =>
    "Тренировка отменена. Неоплаченные записи сняты; по оплатившим оформите возврат или перенос.",
  refunded: (n) => `Возврат оформлен: ${n ?? 0}.`,
  transferred: (n) => `Оплата перенесена: ${n ?? 0}.`,
};

const CHANGE_LABELS: Record<string, string> = {
  title: "название",
  priceCents: "цена",
  capacity: "лимит мест",
  registrationEnabled: "приём записи",
  onlinePaymentEnabled: "онлайн-оплата",
  startsAt: "начало",
  endsAt: "окончание",
  gatherAt: "сбор",
};

function parseTab(raw: string | undefined): Tab {
  return raw === "settings" || raw === "history" ? raw : "participants";
}

function parseFilter(raw: string | undefined): ParticipantsFilter {
  return raw === "unpaid" || raw === "paid" || raw === "closed"
    ? raw
    : "active";
}

function tabHref(id: string, tab: Tab, extra?: Record<string, string>) {
  const params = new URLSearchParams({
    ...(tab === "participants" ? {} : { tab }),
    ...extra,
  }).toString();
  return `/admin/sessions/${id}${params ? `?${params}` : ""}`;
}

export default async function AdminSessionPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const query = await searchParams;
  const row = await getAdminSession(id);
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
      <Link
        href="/admin/sessions"
        className="caption"
        style={{ color: "var(--ink-muted)" }}
      >
        ← Тренировки
      </Link>

      <header className="nl-admin-session-head">
        <div>
          <h1 className="nl-display nl-admin-title-sm" style={{ margin: 0 }}>
            {session.title}
          </h1>
          <p
            className="nl-mono data-sm"
            style={{ color: "var(--ink-2)", margin: "var(--space-2) 0 0" }}
          >
            {formatShortListDate(session.startsAt)} ·{" "}
            {formatTimeRange(session.startsAt, session.endsAt)}
            {session.gatherAt
              ? ` · сбор ${formatTimeHm(session.gatherAt)}`
              : ""}
          </p>
          <div className="nl-admin-session-head__meta">
            <TrainingStatusBadge status={displayStatus} />
            <span className="nl-mono data-sm">
              Занято {row.taken}
              {session.capacity !== null ? ` из ${session.capacity}` : ""}
              {session.priceCents > 0
                ? ` · оплатили ${row.paid} · ждут оплаты ${row.unpaid} · собрано ${consequences.collectedLabel}`
                : " · бесплатно"}
            </span>
          </div>
          {isCancelled && session.cancellationReason ? (
            <p className="caption" style={{ color: "var(--ink-muted)" }}>
              Причина отмены: {session.cancellationReason}
            </p>
          ) : null}
        </div>
        <div className="nl-admin-session-head__actions">
          {announcement ? (
            <>
              {isPostLive(announcement, now) ? (
                <Link
                  href={`/feed/${announcement.id}`}
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
            <>
              <RescheduleDialog
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
                defaultBody={defaultTrainingCancellationBody(session.startsAt)}
                consequences={consequences}
                action={cancelTrainingAction}
              />
            </>
          ) : null}
        </div>
      </header>

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

      {tab === "participants" ? (
        <ParticipantsTab
          sessionId={session.id}
          priceCents={session.priceCents}
          currency={session.currency}
          isCancelled={isCancelled}
          paidCount={row.paid}
          filter={filter}
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

      {tab === "history" ? <HistoryTab sessionId={session.id} /> : null}
    </main>
  );
}

async function ParticipantsTab({
  sessionId,
  priceCents,
  currency,
  isCancelled,
  paidCount,
  filter,
}: {
  sessionId: string;
  priceCents: number;
  currency: string;
  isCancelled: boolean;
  paidCount: number;
  filter: ParticipantsFilter;
}) {
  const [rows, targets] = await Promise.all([
    listSessionRegistrationsAdmin(sessionId, filter),
    listTransferTargets(sessionId),
  ]);
  const filterHref = (key: ParticipantsFilter) =>
    tabHref(sessionId, "participants", key === "active" ? {} : { filter: key });
  const transferTargets = targets.map((t) => ({
    sessionId: t.id,
    label: `${formatShortListDate(t.startsAt)} · ${formatTimeHm(t.startsAt)} — ${t.title}`,
  }));

  return (
    <section>
      <FilterNav
        label="Фильтр участников"
        value={filterHref(filter)}
        options={PARTICIPANTS_FILTERS.map((f) => ({
          href: filterHref(f.key),
          label: f.label,
        }))}
      />

      {isCancelled && paidCount > 0 && priceCents > 0 ? (
        <div className="nl-admin-callout nl-admin-callout--row">
          <p className="caption" style={{ margin: 0 }}>
            Тренировка отменена, оплатили {paidCount}. Оформите возврат или
            перенесите оплату на другую тренировку.
          </p>
          <div className="nl-admin-callout__actions">
            <RefundAllForm
              sessionId={sessionId}
              paidCount={paidCount}
              action={refundAllPaidAction}
            />
            <TransferAllDialog
              sessionId={sessionId}
              paidCount={paidCount}
              targets={transferTargets}
              action={transferAllPaidAction}
            />
          </div>
        </div>
      ) : null}

      <SessionParticipantsTable
        sessionId={sessionId}
        priceCents={priceCents}
        currency={currency}
        rows={rows}
        transferTargets={transferTargets}
      />
    </section>
  );
}

async function SettingsTab({
  session,
}: {
  session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>["session"];
}) {
  const scheduleEditable = await canEditScheduleDirectly(session.id);
  return (
    <section style={{ maxWidth: 560 }}>
      <form action={updateTrainingSettingsAction} className="nl-field">
        <input type="hidden" name="session_id" value={session.id} />
        <TrainingFields values={session} scheduleEditable={scheduleEditable} />
        {!scheduleEditable ? (
          <p className="caption" style={{ color: "var(--ink-muted)" }}>
            Дата и время: {formatDateTimeRu(session.startsAt)}. Чтобы изменить —
            «Перенести…» (участники увидят пост о переносе).
          </p>
        ) : null}
        <button type="submit" className="nl-button nl-button--primary">
          Сохранить параметры
        </button>
      </form>
    </section>
  );
}

function describeEvent(kind: string, payload: Record<string, unknown>): string {
  switch (kind) {
    case "created":
      return "Тренировка создана";
    case "updated": {
      const changes = Object.keys(
        (payload.changes as Record<string, unknown> | undefined) ?? {},
      ).map((k) => CHANGE_LABELS[k] ?? k);
      return changes.length
        ? `Изменены параметры: ${changes.join(", ")}`
        : "Изменены параметры";
    }
    case "rescheduled": {
      const from = payload.previousStartsAt as string | undefined;
      const to = payload.newStartsAt as string | undefined;
      return from && to
        ? `Перенос: ${formatDateTimeRu(from)} → ${formatDateTimeRu(to)}`
        : "Перенос";
    }
    case "cancelled": {
      const reason = payload.reason as string | null | undefined;
      return reason ? `Отмена: ${reason}` : "Отмена";
    }
    default:
      return kind;
  }
}

async function HistoryTab({ sessionId }: { sessionId: string }) {
  const [events, posts] = await Promise.all([
    listSessionEvents(sessionId),
    listPostsForSession(sessionId),
  ]);
  const now = new Date();
  return (
    <section>
      <h2 className="nl-label">Публикации</h2>
      {posts.length === 0 ? (
        <p className="caption">Публикаций нет.</p>
      ) : (
        <ul className="nl-admin-timeline">
          {posts.map((p) => (
            <li key={p.id}>
              <span
                className="nl-mono data-sm"
                style={{ color: "var(--ink-muted)" }}
              >
                {formatDateTimeRu(p.publishedAt ?? p.createdAt)}
              </span>
              <Link href={`/admin/posts/${p.id}`}>
                {FEED_POST_TYPE_LABELS[p.type]}: {p.title}
              </Link>
              <PostStatusBadge
                status={p.status}
                publishedAt={p.publishedAt}
                now={now}
              />
            </li>
          ))}
        </ul>
      )}

      <h2 className="nl-label" style={{ marginTop: "var(--space-6)" }}>
        Журнал
      </h2>
      <ol className="nl-admin-timeline">
        {events.map(({ event, actorName, post }) => (
          <li key={event.id}>
            <span
              className="nl-mono data-sm"
              style={{ color: "var(--ink-muted)" }}
            >
              {formatDateTimeRu(event.createdAt)}
            </span>
            <span>
              {describeEvent(event.kind, event.payload ?? {})}
              {actorName ? (
                <span style={{ color: "var(--ink-muted)" }}>
                  {" "}
                  · {actorName}
                </span>
              ) : null}
            </span>
            {post?.id ? (
              <Link href={`/admin/posts/${post.id}`}>
                {FEED_POST_TYPE_LABELS[post.type]}: {post.title}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
