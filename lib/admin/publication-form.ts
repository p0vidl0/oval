/** Статус публикации из формы редактора (сразу / по расписанию / черновик). */
import { isPostLive } from "@/lib/feed/publication";
import type { FeedPostStatus } from "@/lib/feed/types";
import { parseClubDateTime } from "@/lib/format/datetime";

export type SubmitAction =
  | "save"
  | "publish"
  | "schedule"
  | "draft"
  | "unpublish";

/** Ошибка ввода, которую показываем на странице, а не экраном ошибки. */
export class PublicationError extends Error {}

export function readPublishToTelegram(formData: FormData): boolean {
  return formData.get("publish_to_telegram") === "on";
}

export function readSubmitAction(formData: FormData): SubmitAction {
  const raw = String(formData.get("submit_action") ?? "save");
  return raw === "publish" ||
    raw === "schedule" ||
    raw === "draft" ||
    raw === "unpublish"
    ? raw
    : "save";
}

/** Время отложенной публикации (`publish_date` + `publish_time`, часовой пояс клуба). */
export function readScheduledAt(formData: FormData, now = new Date()): Date {
  const at = parseClubDateTime(
    String(formData.get("publish_date") ?? ""),
    String(formData.get("publish_time") ?? ""),
  );
  if (!at) throw new PublicationError("Укажите дату и время публикации");
  if (at.getTime() <= now.getTime()) {
    throw new PublicationError("Время публикации должно быть в будущем");
  }
  return at;
}

export type PublicationState = {
  status: FeedPostStatus;
  publishedAt: Date | null;
  unpublishedAt: Date | null;
};

/** Статус нового поста по нажатой кнопке. */
export function initialPublicationState(
  formData: FormData,
  now = new Date(),
): PublicationState {
  switch (readSubmitAction(formData)) {
    case "publish":
      return { status: "published", publishedAt: now, unpublishedAt: null };
    case "schedule":
      return {
        status: "published",
        publishedAt: readScheduledAt(formData, now),
        unpublishedAt: null,
      };
    default:
      return { status: "draft", publishedAt: null, unpublishedAt: null };
  }
}

/** Переход статуса существующего поста. */
export function nextPublicationState(
  formData: FormData,
  current: PublicationState,
  now = new Date(),
): PublicationState {
  const live = isPostLive(current, now);
  switch (readSubmitAction(formData)) {
    case "publish":
      return {
        status: "published",
        // Снятый пост возвращается на прежнее место в ленте; отложенный — публикуется сейчас.
        publishedAt:
          current.publishedAt && current.publishedAt <= now
            ? current.publishedAt
            : now,
        unpublishedAt: null,
      };
    case "schedule":
      if (live) {
        throw new PublicationError(
          "Пост уже в ленте — чтобы запланировать, сначала снимите его с публикации",
        );
      }
      return {
        status: "published",
        publishedAt: readScheduledAt(formData, now),
        unpublishedAt: null,
      };
    case "draft":
      // Отмена отложенной публикации.
      if (current.status === "published" && !live) {
        return {
          status: "draft",
          publishedAt: null,
          unpublishedAt: current.unpublishedAt,
        };
      }
      return current;
    case "unpublish":
      return live
        ? {
            status: "unpublished",
            publishedAt: current.publishedAt,
            unpublishedAt: now,
          }
        : current;
    default:
      return current;
  }
}
