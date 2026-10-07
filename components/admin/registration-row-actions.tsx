"use client";

import type { ReactNode } from "react";
import { AdminDialog, DialogActions } from "@/components/admin/admin-dialog";
import { formatPriceRub } from "@/lib/format/datetime";

export type TransferTarget = {
  sessionId: string;
  label: string;
};

type Props = {
  registrationId: string;
  status: string;
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

function markPaidConfirm(priceCents: number) {
  return `Отметить оплату ${formatPriceRub(priceCents)}? Запись станет оплаченной, сумма попадёт в «собрано».`;
}

function confirmSubmit(message: string) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    if (!confirm(message)) event.preventDefault();
  };
}

export function AdminRegistrationRowActions({
  registrationId,
  status,
  priceCents,
  currentSessionId,
  transferTargets,
  markPaidAction,
  refundAction,
  transferAction,
  removeAction,
}: Props) {
  const isPaidWithPrice = status === "paid" && priceCents > 0;
  const isActive = status === "pending_payment" || status === "paid";
  const items: ReactNode[] = [];

  if (status === "pending_payment" && priceCents > 0) {
    items.push(
      <form
        key="mark-paid"
        action={markPaidAction}
        onSubmit={confirmSubmit(markPaidConfirm(priceCents))}
      >
        <input type="hidden" name="registration_id" value={registrationId} />
        <input type="hidden" name="session_id" value={currentSessionId} />
        <button
          type="submit"
          className="nl-button nl-button--text nl-button--sm"
        >
          Оплачено
        </button>
      </form>,
    );
  }

  if (isPaidWithPrice) {
    items.push(
      <form
        key="refund"
        action={refundAction}
        onSubmit={confirmSubmit(REFUND_CONFIRM)}
      >
        <input type="hidden" name="registration_id" value={registrationId} />
        <button
          type="submit"
          className="nl-button nl-button--text nl-button--sm"
        >
          Возврат
        </button>
      </form>,
    );
    if (transferTargets.length > 0) {
      items.push(
        <AdminDialog
          key="transfer"
          title="Перенести оплату"
          triggerLabel="Перенести оплату"
          triggerClassName="nl-button nl-button--text nl-button--sm"
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
  } else if (isActive) {
    items.push(
      <form
        key="cancel"
        action={removeAction}
        onSubmit={confirmSubmit(CANCEL_CONFIRM)}
      >
        <input type="hidden" name="registration_id" value={registrationId} />
        <button
          type="submit"
          className="nl-button nl-button--text nl-button--sm"
        >
          Снять запись
        </button>
      </form>,
    );
  }

  if (items.length === 0) return null;
  return (
    <div className="nl-admin-reg-actions">
      <div className="nl-admin-reg-actions__toolbar">{items}</div>
    </div>
  );
}
