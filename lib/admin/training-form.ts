/** Разбор полей тренировки из FormData (server actions). */
import {
  readTrainingScheduleFromForm,
  resolveTrainingCapacity,
} from "@/lib/admin/training-form-schedule";
import type {
  ChangePostInput,
  ChangePostMode,
  TrainingSchedule,
  TrainingSettings,
} from "@/lib/training/session-service";
import { TrainingServiceError } from "@/lib/training/session-service";

export function readTrainingSettingsFromForm(
  formData: FormData,
): TrainingSettings {
  const priceRub = Number(formData.get("price_rub") ?? 0);
  return {
    title: String(formData.get("training_title") ?? "").trim(),
    priceCents: Number.isNaN(priceRub)
      ? Number.NaN
      : Math.round(priceRub * 100),
    capacity: resolveTrainingCapacity(String(formData.get("capacity") ?? "")),
    registrationEnabled: formData.get("registration_enabled") === "on",
    onlinePaymentEnabled: formData.get("online_payment_enabled") === "on",
  };
}

/** Расписание из формы; `null`, если полей даты в форме нет. */
export function readOptionalScheduleFromForm(
  formData: FormData,
): TrainingSchedule | null {
  if (!formData.has("training_date")) return null;
  return readRequiredScheduleFromForm(formData);
}

export function readRequiredScheduleFromForm(
  formData: FormData,
): TrainingSchedule {
  const { startsAt, endsAt, gatherAt } = readTrainingScheduleFromForm(formData);
  if (!startsAt) {
    throw new TrainingServiceError("Укажите дату тренировки и время начала");
  }
  return { startsAt, endsAt, gatherAt };
}

export function readChangePostFromForm(
  formData: FormData,
  defaultTitle: string,
): ChangePostInput {
  const raw = String(formData.get("post_mode") ?? "publish");
  const mode: ChangePostMode =
    raw === "draft" || raw === "none" ? raw : "publish";
  return {
    mode,
    title: String(formData.get("post_title") ?? "").trim() || defaultTitle,
    body: String(formData.get("post_body") ?? "").trim(),
  };
}
