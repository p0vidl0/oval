import { formatTimeHm } from "@/lib/format/datetime";

const TZ = "Asia/Omsk";
const TG_TEXT_LIMIT = 4096;

export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncateTelegramHtml(text: string): string {
  if (text.length <= TG_TEXT_LIMIT) return text;
  return `${text.slice(0, TG_TEXT_LIMIT - 1)}…`;
}

export function formatTelegramAnnouncementDateLine(startsAt: Date): string {
  const dayMonth = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  })
    .format(startsAt)
    .replace(/\.$/, "");
  const weekday = new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    weekday: "long",
  }).format(startsAt);
  return `🚴‍♂️ ${dayMonth} (${weekday})`;
}

export function formatTelegramAnnouncementStartLine(startsAt: Date): string {
  return `🕗 Начало в ${formatTimeHm(startsAt)}`;
}

/** Анонс: две строки расписания + текст (без заголовка поста). */
export function formatTrainingAnnouncementTelegramHtml(
  startsAt: Date,
  body: string,
): string {
  const lines = [
    formatTelegramAnnouncementDateLine(startsAt),
    formatTelegramAnnouncementStartLine(startsAt),
  ];
  const trimmedBody = body.trim();
  if (trimmedBody) {
    lines.push("", escapeTelegramHtml(trimmedBody));
  }
  return truncateTelegramHtml(lines.join("\n"));
}

export function formatFeedPostTelegramHtml(
  title: string,
  body: string,
): string {
  const safeTitle = escapeTelegramHtml(title.trim());
  const trimmedBody = body.trim();
  const bodyPart = trimmedBody ? `\n\n${escapeTelegramHtml(trimmedBody)}` : "";
  return truncateTelegramHtml(`<b>${safeTitle}</b>${bodyPart}`);
}
