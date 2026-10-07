import {
  DEFAULT_TRAINING_CAPACITY,
  DEFAULT_TRAINING_END_TIME,
  DEFAULT_TRAINING_GATHER_TIME,
  DEFAULT_TRAINING_PRICE_RUB,
  DEFAULT_TRAINING_START_TIME,
} from "@/lib/admin/training-form-schedule";
import { formatDateInput, formatTimeInput } from "@/lib/format/datetime";

/** Временно: нельзя менять «Принимать оплату онлайн» в форме. */
export const ONLINE_PAYMENT_TOGGLE_DISABLED = true;

export type TrainingFieldsValues = {
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  gatherAt: Date | null;
  priceCents: number;
  capacity: number | null;
  registrationEnabled: boolean;
  onlinePaymentEnabled: boolean;
};

type Props = {
  values?: TrainingFieldsValues | null;
  /** false — дата и время только для чтения (меняются через «Перенести»). */
  scheduleEditable?: boolean;
};

/** Поля тренировки: создание и вкладка «Параметры». Имена полей — как в `lib/admin/training-form.ts`. */
export function TrainingFields({ values, scheduleEditable = true }: Props) {
  const v = values;
  return (
    <>
      <label className="nl-label" htmlFor="training_title">
        Название тренировки
        <input
          id="training_title"
          name="training_title"
          required
          className="nl-input"
          defaultValue={v?.title ?? ""}
          placeholder="Например, «Техничная»"
        />
      </label>

      {scheduleEditable ? (
        <>
          <div className="nl-form-row">
            <label className="nl-label" htmlFor="training_date">
              Дата тренировки
              <input
                id="training_date"
                name="training_date"
                type="date"
                className="nl-input nl-input--mono"
                defaultValue={v ? formatDateInput(v.startsAt) : ""}
                required
              />
            </label>
            <label className="nl-label" htmlFor="gather_time">
              Сбор
              <input
                id="gather_time"
                name="gather_time"
                type="time"
                step={60}
                className="nl-input nl-input--mono"
                defaultValue={
                  v?.gatherAt
                    ? formatTimeInput(v.gatherAt)
                    : DEFAULT_TRAINING_GATHER_TIME
                }
              />
            </label>
          </div>
          <div className="nl-form-row">
            <label className="nl-label" htmlFor="start_time">
              Начало
              <input
                id="start_time"
                name="start_time"
                type="time"
                step={60}
                className="nl-input nl-input--mono"
                defaultValue={
                  v ? formatTimeInput(v.startsAt) : DEFAULT_TRAINING_START_TIME
                }
                required
              />
            </label>
            <label className="nl-label" htmlFor="end_time">
              Окончание
              <input
                id="end_time"
                name="end_time"
                type="time"
                step={60}
                className="nl-input nl-input--mono"
                defaultValue={
                  v?.endsAt
                    ? formatTimeInput(v.endsAt)
                    : DEFAULT_TRAINING_END_TIME
                }
              />
            </label>
          </div>
        </>
      ) : null}

      <div className="nl-form-row">
        <label className="nl-label" htmlFor="capacity">
          Лимит мест
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            className="nl-input"
            defaultValue={v?.capacity ?? DEFAULT_TRAINING_CAPACITY}
          />
        </label>
        <label className="nl-label" htmlFor="price_rub">
          Стоимость, ₽
          <input
            id="price_rub"
            name="price_rub"
            type="number"
            min={0}
            className="nl-input"
            defaultValue={
              v ? Math.round(v.priceCents / 100) : DEFAULT_TRAINING_PRICE_RUB
            }
          />
        </label>
      </div>

      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="nl-label">Запись</legend>
        <label className="nl-check">
          <input
            name="registration_enabled"
            type="checkbox"
            defaultChecked={v?.registrationEnabled ?? true}
          />
          Открыть запись — кнопка «Записаться»
        </label>
        {ONLINE_PAYMENT_TOGGLE_DISABLED && v?.onlinePaymentEnabled ? (
          <input type="hidden" name="online_payment_enabled" value="on" />
        ) : null}
        <label
          className="nl-check"
          title={
            ONLINE_PAYMENT_TOGGLE_DISABLED ? "Временно недоступно" : undefined
          }
        >
          <input
            type="checkbox"
            name={
              ONLINE_PAYMENT_TOGGLE_DISABLED
                ? undefined
                : "online_payment_enabled"
            }
            disabled={ONLINE_PAYMENT_TOGGLE_DISABLED}
            defaultChecked={
              ONLINE_PAYMENT_TOGGLE_DISABLED
                ? (v?.onlinePaymentEnabled ?? false)
                : (v?.onlinePaymentEnabled ?? true)
            }
          />
          Принимать оплату онлайн — кнопка «Оплатить»
        </label>
      </fieldset>
    </>
  );
}
