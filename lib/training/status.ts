/** Статусы тренировок и записей для UI (чистые функции, без БД). */

export type TrainingSessionStatus = "scheduled" | "cancelled";

export type TrainingDisplayStatus =
  | "scheduled"
  | "rescheduled"
  | "cancelled"
  | "past";

export const TRAINING_STATUS_LABELS: Record<TrainingDisplayStatus, string> = {
  scheduled: "Запланирована",
  rescheduled: "Перенесена",
  cancelled: "Отменена",
  past: "Прошла",
};

export function trainingDisplayStatus(params: {
  status: TrainingSessionStatus;
  startsAt: Date;
  wasRescheduled: boolean;
  now: Date;
}): TrainingDisplayStatus {
  if (params.status === "cancelled") return "cancelled";
  if (params.startsAt.getTime() < params.now.getTime()) return "past";
  return params.wasRescheduled ? "rescheduled" : "scheduled";
}

export type RegistrationStatus =
  | "pending_payment"
  | "paid"
  | "cancelled"
  | "refunded"
  | "transferred";

export type RegistrationCancelSource = "user" | "admin" | "session_cancelled";

/** Занимают место на тренировке. */
export const ACTIVE_REGISTRATION_STATUSES = [
  "pending_payment",
  "paid",
] as const satisfies readonly RegistrationStatus[];

/** Запись закрыта: место освобождено. */
export const CLOSED_REGISTRATION_STATUSES = [
  "cancelled",
  "refunded",
  "transferred",
] as const satisfies readonly RegistrationStatus[];

export function isActiveRegistrationStatus(
  status: string,
): status is (typeof ACTIVE_REGISTRATION_STATUSES)[number] {
  return status === "pending_payment" || status === "paid";
}

export function isClosedRegistrationStatus(
  status: string,
): status is (typeof CLOSED_REGISTRATION_STATUSES)[number] {
  return (
    status === "cancelled" || status === "refunded" || status === "transferred"
  );
}

/** Текст статуса записи для админки. */
export function adminRegistrationStatusLabel(registration: {
  status: RegistrationStatus;
  cancelledBy: RegistrationCancelSource | null;
  priceCents: number;
}): string {
  switch (registration.status) {
    case "paid":
      return registration.priceCents > 0 ? "Оплачено" : "Записан";
    case "pending_payment":
      return "Ждёт оплаты";
    case "refunded":
      return "Возврат";
    case "transferred":
      return "Оплата перенесена";
    case "cancelled":
      switch (registration.cancelledBy) {
        case "user":
          return "Отменил участник";
        case "admin":
          return "Отменена клубом";
        case "session_cancelled":
          return "Тренировка отменена";
        default:
          return "Отменена";
      }
  }
}

export const PAID_CANCEL_MESSAGE =
  "Оплаченную запись отменяет тренер — напишите ему, он оформит возврат или перенос.";

/** Участник сам снимает только неоплаченную или бесплатную запись. */
export function canUserCancelRegistration(
  registration: { status: string },
  session: { priceCents: number },
) {
  return !(registration.status === "paid" && session.priceCents > 0);
}
