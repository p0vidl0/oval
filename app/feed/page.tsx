import { permanentRedirect } from "next/navigation";
import { feedListPath } from "@/lib/feed/feed-list-path";
import type { FeedFilterKey } from "@/lib/feed/filter";

type Props = {
  searchParams: Promise<{ filter?: string }>;
};

/** Старый URL ленты → главная. */
export default async function FeedLegacyRedirect({ searchParams }: Props) {
  const { filter } = await searchParams;
  const key = (filter as FeedFilterKey | undefined) ?? "all";
  permanentRedirect(feedListPath(key));
}
