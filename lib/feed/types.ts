export const FEED_POST_TYPES = [
  "training_announcement",
  "training_cancelled",
  "training_rescheduled",
  "news",
  "race",
] as const;

export type FeedPostType = (typeof FEED_POST_TYPES)[number];

export const FEED_POST_TYPE_LABELS: Record<FeedPostType, string> = {
  training_announcement: "Анонс тренировки",
  training_cancelled: "Отмена",
  training_rescheduled: "Перенос",
  news: "Новость",
  race: "Соревнования",
};

export type FeedPostMeta = {
  externalUrl?: string;
  eventStartsAt?: string;
  previousStartsAt?: string;
  previousEndsAt?: string | null;
  newStartsAt?: string;
  newEndsAt?: string | null;
};

export type FeedPostStatus = "draft" | "published" | "unpublished";

export const FEED_POST_STATUS_LABELS: Record<FeedPostStatus, string> = {
  draft: "Черновик",
  published: "Опубликовано",
  unpublished: "Снято с публикации",
};
