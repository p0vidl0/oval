"use client";

import { useState } from "react";
import { AdminDialog, DialogActions } from "@/components/admin/admin-dialog";
import type { TransferTarget } from "@/components/admin/registration-row-actions";

type Action = (formData: FormData) => Promise<void>;

function PostModeFields({
  idPrefix,
  defaultTitle,
  defaultBody,
  bodyPlaceholder,
}: {
  idPrefix: string;
  defaultTitle: string;
  defaultBody?: string;
  bodyPlaceholder?: string;
}) {
  const [mode, setMode] = useState("publish");
  return (
    <fieldset className="nl-field" style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="nl-label">Пост в ленте</legend>
      <label className="nl-check">
        <input
          type="radio"
          name="post_mode"
          value="publish"
          checked={mode === "publish"}
          onChange={() => setMode("publish")}
        />
        Опубликовать сразу
      </label>
      <label className="nl-check">
        <input
          type="radio"
          name="post_mode"
          value="draft"
          checked={mode === "draft"}
          onChange={() => setMode("draft")}
        />
        Сохранить черновиком
      </label>
      <label className="nl-check">
        <input
          type="radio"
          name="post_mode"
          value="none"
          checked={mode === "none"}
          onChange={() => setMode("none")}
        />
        Без поста
      </label>
      {mode !== "none" ? (
        <>
          <label className="nl-label" htmlFor={`${idPrefix}-post-title`}>
            Заголовок
            <input
              id={`${idPrefix}-post-title`}
              name="post_title"
              className="nl-input"
              defaultValue={defaultTitle}
            />
          </label>
          <label className="nl-label" htmlFor={`${idPrefix}-post-body`}>
            Текст
            <textarea
              id={`${idPrefix}-post-body`}
              name="post_body"
              rows={3}
              className="nl-input"
              defaultValue={defaultBody}
              placeholder={bodyPlaceholder}
            />
          </label>
        </>
      ) : null}
    </fieldset>
  );
}

export type SessionConsequences = {
  active: number;
  paid: number;
  unpaid: number;
  collectedLabel: string;
};

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function registrationsLabel(n: number) {
  return `${n} ${plural(n, "запись", "записи", "записей")}`;
}

export function RescheduleDialog({
  sessionId,
  defaults,
  consequences,
  action,
}: {
  sessionId: string;
  defaults: { date: string; gather: string; start: string; end: string };
  consequences: SessionConsequences;
  action: Action;
}) {
  return (
    <AdminDialog title="Перенос тренировки" triggerLabel="Перенести…" wide>
      {(close) => (
        <form action={action} className="nl-dialog__body">
          <input type="hidden" name="session_id" value={sessionId} />
          <div className="nl-form-row">
            <label className="nl-label" htmlFor="reschedule-date">
              Дата
              <input
                id="reschedule-date"
                name="training_date"
                type="date"
                className="nl-input nl-input--mono"
                defaultValue={defaults.date}
                required
              />
            </label>
            <label className="nl-label" htmlFor="reschedule-gather">
              Сбор
              <input
                id="reschedule-gather"
                name="gather_time"
                type="time"
                step={60}
                className="nl-input nl-input--mono"
                defaultValue={defaults.gather}
              />
            </label>
          </div>
          <div className="nl-form-row">
            <label className="nl-label" htmlFor="reschedule-start">
              Начало
              <input
                id="reschedule-start"
                name="start_time"
                type="time"
                step={60}
                className="nl-input nl-input--mono"
                defaultValue={defaults.start}
                required
              />
            </label>
            <label className="nl-label" htmlFor="reschedule-end">
              Окончание
              <input
                id="reschedule-end"
                name="end_time"
                type="time"
                step={60}
                className="nl-input nl-input--mono"
                defaultValue={defaults.end}
              />
            </label>
          </div>
          <PostModeFields
            idPrefix="reschedule"
            defaultTitle="Перенос тренировки"
            bodyPlaceholder="Причина переноса…"
          />
          <p className="caption nl-dialog__note">
            {consequences.active > 0
              ? `${registrationsLabel(consequences.active)} сохранятся — участники останутся записаны на новое время.`
              : "Записей пока нет."}
          </p>
          <DialogActions onCancel={close} submitLabel="Перенести" />
        </form>
      )}
    </AdminDialog>
  );
}

export function CancelSessionDialog({
  sessionId,
  defaultBody,
  consequences,
  action,
}: {
  sessionId: string;
  defaultBody: string;
  consequences: SessionConsequences;
  action: Action;
}) {
  return (
    <AdminDialog
      title="Отмена тренировки"
      triggerLabel="Отменить…"
      triggerClassName="nl-button nl-button--danger"
      wide
    >
      {(close) => (
        <form
          action={action}
          className="nl-dialog__body"
          onSubmit={(e) => {
            if (!confirm("Отменить тренировку? Действие необратимо.")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="session_id" value={sessionId} />
          <label className="nl-label" htmlFor="cancel-reason">
            Причина (видна только в админке)
            <input
              id="cancel-reason"
              name="cancellation_reason"
              className="nl-input"
              placeholder="Например, дождь"
            />
          </label>
          <PostModeFields
            idPrefix="cancel"
            defaultTitle="Тренировка отменена"
            defaultBody={defaultBody}
          />
          <div className="nl-admin-callout">
            {consequences.active === 0 ? (
              <p className="caption">Записей нет.</p>
            ) : (
              <>
                {consequences.unpaid > 0 ? (
                  <p className="caption">
                    {registrationsLabel(consequences.unpaid)} без оплаты будут
                    сняты.
                  </p>
                ) : null}
                {consequences.paid > 0 ? (
                  <p className="caption">
                    {registrationsLabel(consequences.paid)} оплачено (
                    {consequences.collectedLabel}) — после отмены оформите
                    возврат или перенос оплаты.
                  </p>
                ) : null}
              </>
            )}
          </div>
          <DialogActions
            onCancel={close}
            submitLabel="Отменить тренировку"
            submitClassName="nl-button nl-button--danger nl-button--sm"
          />
        </form>
      )}
    </AdminDialog>
  );
}

export function TransferAllDialog({
  sessionId,
  paidCount,
  targets,
  action,
}: {
  sessionId: string;
  paidCount: number;
  targets: TransferTarget[];
  action: Action;
}) {
  return (
    <AdminDialog
      title="Перенести оплату всех"
      triggerLabel="Перенести всех на…"
      triggerDisabled={targets.length === 0}
    >
      {(close) => (
        <form action={action} className="nl-dialog__body">
          <input type="hidden" name="session_id" value={sessionId} />
          <label className="nl-label">
            Тренировка
            <select name="target_session_id" className="nl-input" required>
              {targets.map((t) => (
                <option key={t.sessionId} value={t.sessionId}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <p className="caption nl-dialog__note">
            {registrationsLabel(paidCount)} будут перенесены как оплаченные.
          </p>
          <DialogActions onCancel={close} submitLabel="Перенести" />
        </form>
      )}
    </AdminDialog>
  );
}

export function RefundAllForm({
  sessionId,
  paidCount,
  action,
}: {
  sessionId: string;
  paidCount: number;
  action: Action;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Оформить возврат по ${registrationsLabel(paidCount)}? Записи будут закрыты.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="session_id" value={sessionId} />
      <button type="submit" className="nl-button">
        Возврат всем
      </button>
    </form>
  );
}
