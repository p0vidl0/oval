import { formatDateTimeRu } from "@/lib/format/datetime";

/** Текст поста об отмене по умолчанию (редактор может дописать причину). */
export function defaultTrainingCancellationBody(startsAt: Date): string {
  return `Тренировка, запланированная на ${formatDateTimeRu(startsAt)}, отменена.`;
}
