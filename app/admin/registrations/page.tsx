import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClickableRow } from "@/components/admin/clickable-row";
import { Pagination } from "@/components/admin/pagination";
import { AdminRegistrationRowActions } from "@/components/admin/registration-row-actions";
import { NlStatus } from "@/components/nl/status";
import { BackLink } from "@/components/nl/ui";
import { parsePageRequest } from "@/lib/admin/pagination";
import {
  adminMarkPaidForm,
  adminMarkRefundedForm,
  adminRemoveRegistrationForm,
  adminTransferPaymentForm,
} from "@/lib/admin/registration-actions";
import { describeRegistration } from "@/lib/domain/registration/describe";
import {
  formatPriceRub,
  formatShortListDate,
  formatTimeHm,
} from "@/lib/format/datetime";
import { paymentMethodSuffix } from "@/lib/payments/status";
import {
  getParticipant,
  getParticipantAttendance,
  listParticipantRegistrations,
  listParticipants,
  listTransferTargets,
} from "@/lib/training/admin-queries";

type SearchParams = {
  session?: string;
  q?: string;
  user?: string;
  page?: string;
  size?: string;
};

type Props = { searchParams: Promise<SearchParams> };

const BASE_PATH = "/admin/registrations";

function sessionLabel(s: { startsAt: Date; title: string }) {
  return `${formatShortListDate(s.startsAt)} · ${formatTimeHm(s.startsAt)} — ${s.title}`;
}

export default async function AdminParticipantsPage({ searchParams }: Props) {
  const params = await searchParams;
  // Старые ссылки «Записи по тренировке» → карточка тренировки.
  if (params.session) redirect(`/admin/sessions/${params.session}`);
  if (params.user) return <ParticipantHistory params={params} />;

  const q = params.q?.trim() ?? "";
  const participants = await listParticipants(
    q,
    parsePageRequest(params.page, params.size),
  );

  return (
    <main>
      <div className="nl-admin-head">
        <h1 className="nl-page-title nl-page-title--admin">Участники</h1>
      </div>

      <form action={BASE_PATH} className="nl-admin-search">
        <input
          name="q"
          type="search"
          className="nl-input"
          placeholder="Имя или email"
          defaultValue={q}
          aria-label="Поиск участника"
        />
        <button type="submit" className="nl-button">
          Найти
        </button>
      </form>

      <section className="nl-admin-section">
        <h2 className="nl-label">{q ? "Найдено" : "Все участники"}</h2>
        {participants.total === 0 ? (
          <p className="caption">
            {q ? "Никого не нашли." : "Участников пока нет."}
          </p>
        ) : (
          <div className="nl-table-wrap">
            <table className="nl-table nl-table--valign-middle">
              <thead>
                <tr>
                  <th>Участник</th>
                  <th>Email</th>
                  <th>Записей</th>
                </tr>
              </thead>
              <tbody>
                {participants.items.map((u) => (
                  <ClickableRow key={u.id} href={`${BASE_PATH}?user=${u.id}`}>
                    <td>
                      <Link href={`${BASE_PATH}?user=${u.id}`}>
                        {u.name?.trim() || (
                          <span className="nl-muted">без имени</span>
                        )}
                      </Link>
                    </td>
                    <td className="nl-mono">{u.email}</td>
                    <td className="nl-mono">{u.registrationsCount}</td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          basePath={BASE_PATH}
          params={{ q: q || undefined }}
          page={participants.page}
          pageCount={participants.pageCount}
          total={participants.total}
          size={participants.size}
        />
      </section>
    </main>
  );
}

async function ParticipantHistory({ params }: { params: SearchParams }) {
  const userId = params.user ?? "";
  const participant = await getParticipant(userId);
  if (!participant) notFound();
  const [history, targets, attendance] = await Promise.all([
    listParticipantRegistrations(
      userId,
      parsePageRequest(params.page, params.size),
    ),
    listTransferTargets(),
    getParticipantAttendance(userId),
  ]);
  const rows = history.items;

  return (
    <main>
      <BackLink href="/admin/registrations">Участники</BackLink>
      <h1
        className="nl-display nl-admin-title-sm"
        style={{ marginTop: "var(--space-4)" }}
      >
        {participant.name?.trim() || participant.email}
      </h1>
      <p
        className="nl-mono data-sm"
        style={{ color: "var(--on-page-fg, var(--ink-2))" }}
      >
        {participant.email}
      </p>
      <p className="caption">
        {attendance.percent === null
          ? "Посещаемость: отметок пока нет"
          : `Посещаемость ${attendance.percent}% (${attendance.attended} из ${attendance.marked} отмеченных)`}
      </p>
      {attendance.lastNoShows.length > 0 ? (
        <p className="caption nl-muted">
          Последние прогулы:{" "}
          {attendance.lastNoShows.map((s, i) => (
            <span key={s.registrationId}>
              {i > 0 ? ", " : ""}
              <Link href={`/admin/sessions/${s.sessionId}`}>
                {formatShortListDate(s.startsAt)} {s.title}
              </Link>
            </span>
          ))}
        </p>
      ) : null}

      <div className="nl-table-wrap" style={{ marginTop: "var(--space-6)" }}>
        <table className="nl-table nl-table--valign-middle">
          <thead>
            <tr>
              <th>Тренировка</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3}>Записей нет</td>
              </tr>
            ) : (
              rows.map(({ registration, session, payment }) => {
                const view = describeRegistration({
                  registration,
                  session,
                  viewer: "staff",
                  now: new Date(),
                });
                return (
                  <tr key={registration.id}>
                    <td>
                      <Link href={`/admin/sessions/${session.id}`}>
                        {sessionLabel(session)}
                      </Link>
                      {session.status === "cancelled" ? (
                        <span className="nl-error-text"> · отменена</span>
                      ) : null}
                    </td>
                    <td>
                      <NlStatus variant={view.variant}>
                        {view.label}
                        {view.active &&
                        registration.paymentState === "paid" &&
                        payment
                          ? ` · ${formatPriceRub(payment.amountCents, payment.currency)}${paymentMethodSuffix(payment.method)}`
                          : ""}
                      </NlStatus>
                    </td>
                    <td>
                      <AdminRegistrationRowActions
                        registrationId={registration.id}
                        participantName={
                          participant.name?.trim() ||
                          participant.email ||
                          undefined
                        }
                        actions={view.actions}
                        priceCents={session.priceCents}
                        currentSessionId={session.id}
                        transferTargets={targets
                          .filter((t) => t.id !== session.id)
                          .map((t) => ({
                            sessionId: t.id,
                            label: sessionLabel(t),
                          }))}
                        markPaidAction={adminMarkPaidForm}
                        refundAction={adminMarkRefundedForm}
                        transferAction={adminTransferPaymentForm}
                        removeAction={adminRemoveRegistrationForm}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        basePath={BASE_PATH}
        params={{ user: userId }}
        page={history.page}
        pageCount={history.pageCount}
        total={history.total}
        size={history.size}
      />
    </main>
  );
}
