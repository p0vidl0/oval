import type { FeedFilterKey } from "@/lib/feed/filter";

/** Публичная лента (главная). */
export const FEED_LIST_PATH = "/" as const;

export function feedListPath(filter: FeedFilterKey = "all"): string {
  if (filter === "all") return FEED_LIST_PATH;
  return `/?filter=${encodeURIComponent(filter)}`;
}
