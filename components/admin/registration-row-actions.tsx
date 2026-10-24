"use client";

import { Fragment, type ReactNode } from "react";
import { AdminDialog, DialogActions } from "@/components/admin/admin-dialog";
import { AdminMenu } from "@/components/admin/admin-menu";
import { type Attendance, isAbsent } from "@/lib/domain/attendance/rules";
import type { RegistrationActions } from "@/lib/domain/registration/describe";
import { formatPriceRub } from "@/lib/format/datetime";

export type TransferTarget = {
  sessionId: string;
  label: string;
};

type Props = {
  registrationId: string;
  /** Для заголовка диалога «Оплачено». */
  participantName?: string;
  /** Из `describeRegistration(..., viewer: "staff")`. */
  actions: RegistrationActions;
  attendance?: Attendance;
  priceCents: number;
  currentSessionId: string;
  transferTargets: TransferTarget[];
  markPaidAction: (formData: FormData) => Promise<void>;
  refundAction: (formData: FormData) => Promise<void>;
  transferAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
};

const REFUND_CONFIRM =
  "Оформить возврат? Запись на эту тренировку будет закрыта.";

const CANCEL_CONFIRM = "Снять запись? Место на тренировке освободится.";

function confirmSubmit(message: string) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    if (!confirm(message)) event.preventDefault();
  };
}

/**
 * Действия по записи: основная кнопка («Оплачено») под палец, остальное — в
 * меню «…». Что доступно, решает `describeRegistration`, а не компонент.
 */
export function AdminRegistrationRowActions({
  registrationId,
  participantName,
  actions,
  attendance,
  priceCents,
  currentSessionId,
  transferTargets,
  markPaidAction,
  refundAction,
  transferAction,
  removeAction,
}: Props) {
  const menu: ReactNode[] = [];

  // «Уважительная причина» (attendance = excused) временно скрыта.

  if (actions.refund) {
    menu.push(
      <form
        key="refund"
        action={refundAction}
        onSubmit={confirmSubmit(REFUND_CONFIRM)}
      >
        <input type="hidden" name="registration_id" value={registrationId} />
        <button type="submit" role="menuitem">
          Возврат
        </button>
      </form>,
    );
  }

  if (actions.transfer && transferTargets.length > 0) {
    menu.push(
      <AdminDialog
        key="transfer"
        title="Перенести оплату"
        triggerLabel="Перенести оплату…"
        triggerClassName=""
        triggerRole="menuitem"
      >
        {(close) => (
          <form action={transferAction} className="nl-dialog__body">
            <input
              type="hidden"
              name="from_registration_id"
              value={registrationId}
            />
            <label className="nl-label">
              Тренировка
              <select name="target_session_id" className="nl-input" required>
                {transferTargets.map((t) => (
                  <option key={t.sessionId} value={t.sessionId}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="caption nl-dialog__note">
              Участник будет записан на выбранную тренировку как оплативший,
              текущая запись закроется.
            </p>
            <DialogActions onCancel={close} submitLabel="Перенести" />
          </form>
        )}
      </AdminDialog>,
    );
  }

  if (actions.cancel) {
    menu.push(
      <form
        key="cancel"
        action={removeAction}
        onSubmit={confirmSubmit(CANCEL_CONFIRM)}
      >
        <input type="hidden" name="registration_id" value={registrationId} />
        <button
          type="submit"
          role="menuitem"
          className="nl-admin-menu__item--danger"
        >
          Снять запись
        </button>
      </form>,
    );
  }

  // Не пришёл без оплаты — не долг: «Оплачено» уходит в «…» (на случай,
  // если всё же перевёл), основной кнопкой остаётся у пришедших.
  const markPaidInMenu = actions.markPaid && isAbsent(attendance ?? "unknown");
  const markPaidDialog = (inMenu: boolean) => (
    <AdminDialog
      title="Отметить оплату"
      triggerLabel={inMenu ? "Оплачено…" : "Оплачено"}
      triggerClassName={
        inMenu
          ? ""
          : "nl-button nl-button--primary nl-button--sm nl-admin-reg-actions__primary"
      }
      triggerRole={inMenu ? "menuitem" : undefined}
    >
      {(close) => (
        <form action={markPaidAction} className="nl-dialog__body">
          <input type="hidden" name="registration_id" value={registrationId} />
          <input type="hidden" name="session_id" value={currentSessionId} />
          <p className="nl-mark-paid__amount">
            {formatPriceRub(priceCents)}
            {participantName ? ` — ${participantName}` : ""}
          </p>
          <p className="caption nl-dialog__note">
            Как получили оплату? Запись станет оплаченной, сумма попадёт в
            «собрано».
          </p>
          {/* Значение нажатой кнопки уходит в FormData как `method`. */}
          <div className="nl-mark-paid__methods">
            <button
              type="submit"
              name="method"
              value="cash"
              className="nl-button nl-button--primary nl-mark-paid__method"
            >
              Наличными
            </button>
            <button
              type="submit"
              name="method"
              value="bank_transfer"
              className="nl-button nl-button--primary nl-mark-paid__method"
            >
              Переводом
            </button>
          </div>
          <button
            type="button"
            className="nl-button nl-button--text nl-button--sm"
            onClick={close}
          >
            Отмена
          </button>
        </form>
      )}
    </AdminDialog>
  );
  if (markPaidInMenu)
    menu.unshift(<Fragment key="paid">{markPaidDialog(true)}</Fragment>);

  if (!actions.markPaid && menu.length === 0) return null;
  return (
    <div className="nl-admin-reg-actions">
      {actions.markPaid && !markPaidInMenu ? markPaidDialog(false) : null}
      {menu.length > 0 ? (
        <AdminMenu label="Действия с записью">{menu}</AdminMenu>
      ) : null}
    </div>
  );
}
