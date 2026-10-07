import { CopyEmailsButton } from "@/components/admin/copy-emails-button";
import {
  AdminRegistrationRowActions,
  type TransferTarget,
} from "@/components/admin/registration-row-actions";
import { NlStatus } from "@/components/nl/status";
import {
  adminMarkPaidForm,
  adminMarkRefundedForm,
  adminRemoveRegistrationForm,
  adminTransferPaymentForm,
} from "@/lib/admin/registration-actions";
import { formatPriceRub, formatShortListDate } from "@/lib/format/datetime";
import type { listSessionRegistrationsAdmin } from "@/lib/training/admin-queries";
import {
  adminRegistrationStatusLabel,
  isActiveRegistrationStatus,
} from "@/lib/training/status";

type Rows = Awaited<ReturnType<typeof listSessionRegistrationsAdmin>>;

type Props = {
  sessionId: string;
  priceCents: number;
  currency: string;
  rows: Rows;
  transferTargets: TransferTarget[];
};

export function SessionParticipantsTable({
  sessionId,
  priceCents,
  currency,
  rows,
  transferTargets,
}: Props) {
  return (
    <>
      <div className="nl-table-wrap">
        <table className="nl-table nl-table--valign-middle">
          <thead>
            <tr>
              <th>№</th>
              <th>Участник</th>
              <th>Email</th>
              <th>Записался</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>Нет записей</td>
              </tr>
            ) : (
              rows.map(({ registration, user, payment }, index) => {
                const label = adminRegistrationStatusLabel({
                  status: registration.status,
                  cancelledBy: registration.cancelledBy,
                  priceCents,
                });
                const active = isActiveRegistrationStatus(registration.status);
                return (
                  <tr key={registration.id}>
                    <td>{index + 1}</td>
                    <td>
                      {user.name?.trim() || (
                        <span style={{ color: "var(--ink-muted)" }}>
                          без имени
                        </span>
                      )}
                    </td>
                    <td className="nl-mono">{user.email}</td>
                    <td className="nl-mono">
                      {formatShortListDate(registration.createdAt)}
                    </td>
                    <td>
                      <NlStatus
                        variant={
                          registration.status === "pending_payment"
                            ? "due"
                            : active
                              ? "default"
                              : "cancelled"
                        }
                      >
                        {label}
                        {registration.status === "paid" && priceCents > 0
                          ? ` · ${formatPriceRub(
                              payment?.amountCents ?? priceCents,
                              payment?.currency ?? currency,
                            )}`
                          : ""}
                      </NlStatus>
                    </td>
                    <td>
                      <AdminRegistrationRowActions
                        registrationId={registration.id}
                        status={registration.status}
                        priceCents={priceCents}
                        currentSessionId={sessionId}
                        transferTargets={transferTargets}
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
      <div style={{ marginTop: "var(--space-3)" }}>
        <CopyEmailsButton
          emails={rows
            .map((r) => r.user.email)
            .filter((e): e is string => Boolean(e))}
        />
      </div>
    </>
  );
}
