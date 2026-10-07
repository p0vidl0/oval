import Link from "next/link";
import {
  PostStatusBadge,
  TrainingStatusBadge,
} from "@/components/admin/admin-badges";
import { ClickableRow } from "@/components/admin/clickable-row";
import { Pagination } from "@/components/admin/pagination";
import { FilterNav } from "@/components/nl/filter-nav";
import { parsePageRequest } from "@/lib/admin/pagination";
import {
  formatPriceRub,
  formatShortListDate,
  formatTimeHm,
} from "@/lib/format/datetime";
import {
  ADMIN_SESSION_SCOPES,
  type AdminSessionScope,
  listAdminSessions,
  sessionNeedsAttention,
} from "@/lib/training/admin-queries";
import { trainingDisplayStatus } from "@/lib/training/status";

type Props = {
  searchParams: Promise<{ scope?: string; page?: string; size?: string }>;
};

function scopeHref(scope: AdminSessionScope) {
  return scope === "upcoming"
    ? "/admin/sessions"
    : `/admin/sessions?scope=${scope}`;
}

function parseScope(raw: string | undefined): AdminSessionScope {
  return raw === "past" || raw === "cancelled" ? raw : "upcoming";
}

export default async function AdminSessionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const scope = parseScope(params.scope);
  const result = await listAdminSessions(
    scope,
    parsePageRequest(params.page, params.size),
  );
  const rows = result.items;
  const now = new Date();

  return (
    <main>
      <div className="nl-admin-head">
        <h1 className="nl-page-title nl-page-title--admin">Тренировки</h1>
        <Link
          href="/admin/sessions/new"
          className="nl-button nl-button--primary"
        >
          Добавить тренировку
        </Link>
      </div>

      <FilterNav
        label="Период"
        value={scopeHref(scope)}
        options={ADMIN_SESSION_SCOPES.map((s) => ({
          href: scopeHref(s.key),
          label: s.label,
        }))}
      />

      <div className="nl-table-wrap">
        <table className="nl-table nl-table--valign-middle">
          <thead>
            <tr>
              <th>Когда</th>
              <th>Места</th>
              <th>Оплаты</th>
              <th>Тренировка</th>
              <th>Статус</th>
              <th>Анонс</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>Нет тренировок</td>
              </tr>
            ) : (
              rows.map((row) => {
                const { session, announcement } = row;
                const attention = sessionNeedsAttention(row, now);
                return (
                  <ClickableRow
                    key={session.id}
                    href={`/admin/sessions/${session.id}`}
                  >
                    <td className="nl-mono data-sm">
                      {formatShortListDate(session.startsAt)}
                      <span className="nl-show-desktop"> ·</span>{" "}
                      {formatTimeHm(session.startsAt)}
                    </td>
                    <td className="nl-mono data-sm nl-nowrap">
                      {row.taken}
                      {session.capacity !== null
                        ? ` / ${session.capacity}`
                        : ""}
                    </td>
                    <td className="nl-mono data-sm">
                      {session.priceCents > 0
                        ? `${row.paid} · ${formatPriceRub(row.collectedCents)}`
                        : "бесплатно"}
                    </td>
                    <td>
                      <Link href={`/admin/sessions/${session.id}`}>
                        <strong>{session.title}</strong>
                      </Link>
                      {attention ? (
                        <span
                          className="nl-tag nl-tag--cancel"
                          style={{ marginLeft: "var(--space-2)" }}
                          title={
                            session.status === "cancelled"
                              ? "Есть оплаты — нужен возврат или перенос"
                              : "Скоро старт, есть неоплаченные записи"
                          }
                        >
                          !
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <TrainingStatusBadge
                        status={trainingDisplayStatus({
                          status: session.status,
                          startsAt: session.startsAt,
                          wasRescheduled: row.wasRescheduled,
                          now,
                        })}
                      />
                    </td>
                    <td>
                      {announcement ? (
                        <PostStatusBadge
                          status={announcement.status}
                          publishedAt={announcement.publishedAt}
                          now={now}
                        />
                      ) : (
                        <span style={{ color: "var(--ink-muted)" }}>нет</span>
                      )}
                    </td>
                  </ClickableRow>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        basePath="/admin/sessions"
        params={{ scope: scope === "upcoming" ? undefined : scope }}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        size={result.size}
      />
    </main>
  );
}
