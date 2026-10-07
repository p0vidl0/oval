import type { FeedPostType } from "@/lib/feed/types";

export type FeedFilterKey = "all" | "trainings" | "changes" | "news";

export const FEED_FILTERS: { key: FeedFilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "trainings", label: "Тренировки" },
  { key: "changes", label: "Отмены и переносы" },
  { key: "news", label: "Новости" },
];

export function typesForFilter(
  filter: FeedFilterKey | undefined,
): FeedPostType[] | undefined {
  switch (filter) {
    case "trainings":
      return ["training_announcement"];
    case "changes":
      return ["training_cancelled", "training_rescheduled"];
    case "news":
      return ["news"];
    default:
      return undefined;
  }
}

export function postMatchesFilter(
  postType: FeedPostType,
  filter: FeedFilterKey,
): boolean {
  const types = typesForFilter(filter);
  if (!types) return true;
  return types.includes(postType);
}
