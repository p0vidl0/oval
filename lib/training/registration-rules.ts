export type RegistrationBlockReason =
  | "not_scheduled"
  | "registration_disabled"
  | "registration_closed"
  | "registration_not_open"
  | "full"
  | "already_registered"
  | "cancelled_session"
  | "started";

export function isRegistrationOpen(params: {
  now: Date;
  sessionStatus: "scheduled" | "cancelled";
  /** Начало тренировки: после него запись закрыта. */
  startsAt: Date;
  registrationEnabled: boolean;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  activeCount: number;
  capacity: number | null;
  userHasActiveRegistration: boolean;
}): { open: true } | { open: false; reason: RegistrationBlockReason } {
  if (params.sessionStatus !== "scheduled") {
    return { open: false, reason: "not_scheduled" };
  }
  if (params.now >= params.startsAt) {
    return { open: false, reason: "started" };
  }
  if (!params.registrationEnabled) {
    return { open: false, reason: "registration_disabled" };
  }
  if (params.registrationOpensAt && params.now < params.registrationOpensAt) {
    return { open: false, reason: "registration_not_open" };
  }
  if (params.registrationClosesAt && params.now > params.registrationClosesAt) {
    return { open: false, reason: "registration_closed" };
  }
  if (params.userHasActiveRegistration) {
    return { open: false, reason: "already_registered" };
  }
  if (params.capacity !== null && params.activeCount >= params.capacity) {
    return { open: false, reason: "full" };
  }
  return { open: true };
}

export const REGISTRATION_BLOCK_MESSAGES: Record<
  RegistrationBlockReason,
  string
> = {
  not_scheduled: "Тренировка недоступна для записи",
  registration_disabled: "Запись закрыта",
  registration_closed: "Запись закрыта",
  registration_not_open: "Запись ещё не открыта",
  full: "Мест нет",
  already_registered: "Вы уже записаны",
  cancelled_session: "Тренировка отменена",
  started: "Тренировка уже началась",
};
