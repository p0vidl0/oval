/** Статусы тренировок для UI (чистые функции, без БД). Записи — `lib/domain/registration`. */

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
