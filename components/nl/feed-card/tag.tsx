import type { FeedPostType } from "@/lib/feed/types";

export function feedCardTagClass(type: FeedPostType, pinned?: boolean): string {
  if (pinned) return "nl-tag nl-tag--next";
  switch (type) {
    case "training_announcement":
      return "nl-tag nl-tag--training";
    case "training_cancelled":
      return "nl-tag nl-tag--cancel";
    case "training_rescheduled":
      return "nl-tag nl-tag--move";
    case "race":
      return "nl-tag nl-tag--race";
    default:
      return "nl-tag nl-tag--news";
  }
}

export function feedCardTagLabel(type: FeedPostType, pinned?: boolean): string {
  if (pinned) return "Ближайшая тренировка";
  switch (type) {
    case "training_announcement":
      return "Анонс тренировки";
    case "training_cancelled":
      return "Отмена";
    case "training_rescheduled":
      return "Перенос";
    case "race":
      return "Соревнования";
    default:
      return "Новость";
  }
}
