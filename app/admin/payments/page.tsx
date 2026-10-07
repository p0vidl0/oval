import Link from "next/link";
import { Pagination } from "@/components/admin/pagination";
import { AdminRegistrationRowActions } from "@/components/admin/registration-row-actions";
import { FilterNav } from "@/components/nl/filter-nav";
import { parsePageRequest } from "@/lib/admin/pagination";
import {
  adminMarkPaidForm,
  adminMarkRefundedForm,
  adminRemoveRegistrationForm,
  adminTransferPaymentForm,
} from "@/lib/admin/registration-actions";
import {
  formatPriceRub,
  formatShortListDate,
  formatTimeHm,
} from "@/lib/format/datetime";
import {
  listPaidOnCancelled,
  listTransferTargets,
  listUnpaid,
} from "@/lib/training/admin-queries";

type Tab = "unpaid" | "refunds";

type Props = {
  searchParams: Promise<{ tab?: string; page?: string; size?: string }>;
};

const BASE_PATH = "/admin/payments";

const TABS: { key: Tab; label: string }[] = [
  { key: "unpaid", label: "Ждут оплаты" },
  { key: "refunds", label: "Возвраты" },
];

const EMPTY: Record<Tab, string> = {
  unpaid: "Неоплаченных записей нет.",
  refunds: "Нет — все возвраты и переносы оформлены.",
};

const HINT: Record<Tab, string> = {
  unpaid:
    "Платные записи на тренировки, включая прошедшие, где оплату на месте не отметили.",
  refunds:
    "Оплаты на отменённых тренировках: оформите возврат или перенесите оплату на другую тренировку.",
};

function tabHref(tab: Tab) {
  return tab === "unpaid" ? BASE_PATH : `${BASE_PATH}?tab=${tab}`;
}

function sessionLabel(s: { startsAt: Date; title: string }) {
  return `${formatShortListDate(s.startsAt)} · ${formatTimeHm(s.startsAt)} — ${s.title}`;
}

export default async function AdminPaymentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "refunds" ? "refunds" : "unpaid";
  const request = parsePageRequest(params.page, params.size);
  const [result, targets] = await Promise.all([
    tab === "refunds" ? listPaidOnCancelled(request) : listUnpaid(request),
    listTransferTargets(),
  ]);

  return (
    <main>
      <div className="nl-admin-head">
        <h1 className="nl-page-title nl-page-title--admin">Оплата</h1>
      </div>

      <FilterNav
        label="Раздел оплат"
        value={tabHref(tab)}
        options={TABS.map((t) => ({ href: tabHref(t.key), label: t.label }))}
      />
      <p
        className="caption"
        style={{ color: "var(--ink-muted)", margin: "0 0 var(--space-4)" }}
      >
        {HINT[tab]}
      </p>

      {result.total === 0 ? (
        <p className="caption">{EMPTY[tab]}</p>
      ) : (
        <div className="nl-table-wrap">
          <table className="nl-table nl-table--valign-middle">
            <thead>
              <tr>
                <th>Тренировка</th>
                <th>Участник</th>
                <th>Сумма</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map(({ registration, user, session }) => (
                <tr key={registration.id}>
                  <td>
                    <Link
                      href={`/admin/sessions/${session.id}?filter=${
                        tab === "refunds" ? "paid" : "unpaid"
                      }`}
                    >
                      {sessionLabel(session)}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/admin/registrations?user=${user.id}`}>
                      {user.name || user.email}
                    </Link>
                    {user.name ? (
                      <>
                        <br />
                        <span
                          className="nl-mono data-sm"
                          style={{ color: "var(--ink-muted)" }}
                        >
                          {user.email}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td className="nl-mono nl-nowrap">
                    {formatPriceRub(session.priceCents, session.currency)}
                  </td>
                  <td>
                    <AdminRegistrationRowActions
                      registrationId={registration.id}
                      status={registration.status}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath={BASE_PATH}
        params={{ tab: tab === "unpaid" ? undefined : tab }}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        size={result.size}
      />
    </main>
  );
}
