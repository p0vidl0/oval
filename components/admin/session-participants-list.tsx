import { AttendanceButtons } from "@/components/admin/attendance-buttons";
import {
  AdminRegistrationRowActions,
  type TransferTarget,
} from "@/components/admin/registration-row-actions";
import { NlStatus } from "@/components/nl/status";
import { ListRow, ListRows, Muted } from "@/components/nl/ui";
import {
  adminMarkPaidForm,
  adminMarkRefundedForm,
  adminRemoveRegistrationForm,
  adminTransferPaymentForm,
} from "@/lib/admin/registration-actions";
import {
  type DescribeRegistrationInput,
  describeRegistration,
} from "@/lib/domain/registration/describe";
import { formatPriceRub, formatShortListDate } from "@/lib/format/datetime";
import { paymentMethodSuffix } from "@/lib/payments/status";
import type { listSessionRegistrationsAdmin } from "@/lib/training/admin-queries";

type Rows = Awaited<ReturnType<typeof listSessionRegistrationsAdmin>>;

type Props = {
  sessionId: string;
  session: DescribeRegistrationInput["session"] & { currency: string };
  rows: Rows;
  transferTargets: TransferTarget[];
  /** `attendance.markLate`: отметки после окна. */
  attendanceLate?: boolean;
};

/** Список участников под телефон: имя и статус, основное действие, «…». */
export function SessionParticipantsList({
  sessionId,
  session,
  rows,
  transferTargets,
  attendanceLate,
}: Props) {
  const now = new Date();
  return (
    <>
      {rows.length === 0 ? (
        <Muted as="p" className="caption">
          Нет записей
        </Muted>
      ) : (
        <ListRows>
          {rows.map(({ registration, user, payment }) => {
            const view = describeRegistration({
              registration,
              session,
              viewer: "staff",
              now,
              capabilities: { attendanceLate },
            });
            const amount =
              view.active && registration.paymentState === "paid"
                ? ` · ${formatPriceRub(
                    payment?.amountCents ?? session.priceCents,
                    payment?.currency ?? session.currency,
                  )}${paymentMethodSuffix(payment?.method)}`
                : "";
            return (
              <ListRow
                key={registration.id}
                muted={!view.active}
                searchText={[user.name, user.email]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase()}
                title={
                  <>
                    {user.name?.trim() || <Muted>без имени</Muted>}
                    <NlStatus variant={view.variant}>
                      {view.label}
                      {amount}
                    </NlStatus>
                    {view.attendance && !view.actions.markAttendance ? (
                      <NlStatus
                        variant={
                          view.attendance.value === "no_show"
                            ? "cancelled"
                            : "default"
                        }
                      >
                        {view.attendance.label}
                      </NlStatus>
                    ) : null}
                    {registration.source === "coach" ? (
                      <span className="nl-tag nl-tag--plain">без записи</span>
                    ) : null}
                  </>
                }
                meta={[
                  user.email,
                  `записался ${formatShortListDate(registration.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                aside={
                  <>
                    {view.actions.markAttendance ? (
                      <AttendanceButtons
                        registrationId={registration.id}
                        value={registration.attendance}
                      />
                    ) : null}
                    <AdminRegistrationRowActions
                      registrationId={registration.id}
                      participantName={
                        user.name?.trim() || user.email || undefined
                      }
                      actions={view.actions}
                      attendance={registration.attendance}
                      priceCents={session.priceCents}
                      currentSessionId={sessionId}
                      transferTargets={transferTargets}
                      markPaidAction={adminMarkPaidForm}
                      refundAction={adminMarkRefundedForm}
                      transferAction={adminTransferPaymentForm}
                      removeAction={adminRemoveRegistrationForm}
                    />
                  </>
                }
              />
            );
          })}
        </ListRows>
      )}
    </>
  );
}
