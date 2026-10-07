import { parseClubDateTime } from "@/lib/format/datetime";

export const DEFAULT_TRAINING_START_TIME = "20:00";
export const DEFAULT_TRAINING_END_TIME = "21:00";
export const DEFAULT_TRAINING_GATHER_TIME = "19:30";
export const DEFAULT_TRAINING_CAPACITY = 25;
export const DEFAULT_TRAINING_PRICE_RUB = 600;

/** Пустое поле «лимит мест» → {@link DEFAULT_TRAINING_CAPACITY}. */
export function resolveTrainingCapacity(capacityRaw: string): number {
  const trimmed = capacityRaw.trim();
  if (!trimmed) return DEFAULT_TRAINING_CAPACITY;
  return Number(trimmed);
}

/** Нормализует время из `<input type="time">` в HH:mm (24 ч); пустое → fallback. */
export function normalizeTimeField(value: string, fallback: string): string {
  const v = value.trim();
  if (!v) return fallback;
  const hm = v.length >= 5 ? v.slice(0, 5) : v;
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function resolveTrainingTimes(
  date: string,
  startTime: string,
  endTime: string,
  gatherTime: string,
): {
  startsAt: Date | null;
  endsAt: Date | null;
  gatherAt: Date | null;
} {
  if (!date.trim()) {
    return { startsAt: null, endsAt: null, gatherAt: null };
  }
  const start = normalizeTimeField(startTime, DEFAULT_TRAINING_START_TIME);
  const end = normalizeTimeField(endTime, DEFAULT_TRAINING_END_TIME);
  const gather = normalizeTimeField(gatherTime, DEFAULT_TRAINING_GATHER_TIME);
  return {
    startsAt: parseClubDateTime(date, start),
    endsAt: parseClubDateTime(date, end),
    gatherAt: parseClubDateTime(date, gather),
  };
}

export function readTrainingScheduleFromForm(formData: FormData): {
  startsAt: Date | null;
  endsAt: Date | null;
  gatherAt: Date | null;
} {
  const date = String(formData.get("training_date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const gatherTime = String(formData.get("gather_time") ?? "");
  return resolveTrainingTimes(date, startTime, endTime, gatherTime);
}

export function readTrainingScheduleFromHtmlForm(form: HTMLFormElement): {
  trainingDate: string;
  startTime: string;
  endTime: string;
  gatherTime: string;
  startsAt: Date | null;
  endsAt: Date | null;
  gatherAt: Date | null;
} {
  const read = (name: string) => {
    const el = form.elements.namedItem(name);
    if (!(el instanceof HTMLInputElement)) return "";
    return el.value;
  };
  const trainingDate = read("training_date").trim();
  const startTime = read("start_time").trim();
  const endTime = read("end_time").trim();
  const gatherTime = read("gather_time").trim();

  const start = normalizeTimeField(startTime, DEFAULT_TRAINING_START_TIME);
  const end = normalizeTimeField(endTime, DEFAULT_TRAINING_END_TIME);
  const gather = normalizeTimeField(gatherTime, DEFAULT_TRAINING_GATHER_TIME);
  const schedule = resolveTrainingTimes(
    trainingDate,
    startTime,
    endTime,
    gatherTime,
  );

  return {
    trainingDate,
    startTime: start,
    endTime: end,
    gatherTime: gather,
    ...schedule,
  };
}
