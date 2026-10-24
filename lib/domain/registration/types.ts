/**
 * Запись на тренировку — две независимые оси: участие (`status`) и деньги
 * (`paymentState`). Чистые типы и хелперы, без БД.
 */

/** Участие: держит ли запись место на тренировке. */
export const REGISTRATION_STATUSES = ["active", "cancelled"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/**
 * Деньги по записи. `due` у отменённой записи значит «денег не было».
 * `moved` — оплата перенесена на другую тренировку.
 */
export const PAYMENT_STATES = [
  "free",
  "due",
  "paid",
  "refunded",
  "moved",
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

/** Кто или что закрыло запись (для `status = cancelled`). */
export const CANCEL_SOURCES = [
  "user",
  "admin",
  "session_cancelled",
  "transferred",
] as const;
export type CancelSource = (typeof CANCEL_SOURCES)[number];

export function isActiveRegistration(registration: {
  status: RegistrationStatus;
}): boolean {
  return registration.status === "active";
}

/** Состояние оплаты новой записи: бесплатная или ждёт оплаты. */
export function initialPaymentState(priceCents: number): "free" | "due" {
  return priceCents > 0 ? "due" : "free";
}

export const PAID_CANCEL_MESSAGE =
  "Оплаченную запись отменяет тренер — напишите ему, он оформит возврат или перенос.";
