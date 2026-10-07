const TZ = "Asia/Omsk";

export function formatDateTimeRu(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Значение для `<input type="date">` в часовом поясе клуба. */
export function formatDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Значение для `<input type="time">` (HH:mm, 24 часа) в часовом поясе клуба. */
export function formatTimeInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(
    parts.find((p) => p.type === "hour")?.value ?? Number.NaN,
  );
  const minute = Number(
    parts.find((p) => p.type === "minute")?.value ?? Number.NaN,
  );
  if (Number.isNaN(hour) || Number.isNaN(minute)) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Время HH:mm для карточек и подписей (24 часа, Asia/Omsk). */
export function formatTimeHm(d: Date | string): string {
  return formatTimeInput(d) || "—";
}

/** Собрать момент из даты и времени календаря клуба (Asia/Omsk, UTC+6). */
export function parseClubDateTime(date: string, time: string): Date | null {
  const d = date.trim();
  const t = time.trim();
  if (!d || !t) return null;
  const hm = t.length >= 5 ? t.slice(0, 5) : t;
  const parsed = new Date(`${d}T${hm}:00+06:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Значение для `<input type="datetime-local">` в часовом поясе клуба. */
export function formatDatetimeLocalInput(
  d: Date | string | null | undefined,
): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}

export function formatPriceRub(cents: number, currency = "RUB"): string {
  if (currency !== "RUB") {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatTimeRange(
  start: Date | string,
  end: Date | string | null | undefined,
): string {
  const a = formatTimeHm(start);
  if (!end) return a;
  return `${a} — ${formatTimeHm(end)}`;
}

export function formatDateStackParts(d: Date | string): {
  dow: string;
  day: string;
  month: string;
} {
  const date = typeof d === "string" ? new Date(d) : d;
  const dow = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    weekday: "short",
  })
    .format(date)
    .replace(".", "")
    .slice(0, 2)
    .toUpperCase();
  const day = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    day: "2-digit",
  }).format(date);
  const month = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    month: "short",
  })
    .format(date)
    .replace(".", "")
    .slice(0, 3)
    .toLowerCase();
  return { dow, day, month };
}

export function formatShortListDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const dow = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    weekday: "short",
  })
    .format(date)
    .replace(".", "");
  const rest = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  return `${dow} ${rest}`;
}

/** «во вторник» — для фраз вроде «Ждём вас во вторник в 20:15» */
export function formatWeekdayInPhrase(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const wd = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    weekday: "long",
  }).format(date);
  return `в ${wd}`;
}

export function formatRelativeFeedMeta(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const sameDay =
    date.toDateString() === now.toDateString() ||
    Math.abs(now.getTime() - date.getTime()) < 86_400_000;
  if (sameDay) {
    return `сегодня, ${formatTimeHm(date)}`;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
  }).format(date);
}
