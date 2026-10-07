import { publishFeedEvent } from "@/lib/realtime/feed-event-bus";

/**
 * Live-обновление ленты после изменения поста.
 * Отложенный пост здесь не «появляется» — его выпускает `scheduled-publisher`.
 */
export function emitFeedPostLive(
  postId: string,
  isLive: boolean,
  wasLive: boolean,
) {
  if (isLive) {
    publishFeedEvent({
      type: wasLive ? "feed.post_updated" : "feed.post_published",
      postId,
    });
    return;
  }
  if (wasLive) {
    publishFeedEvent({ type: "feed.post_unpublished", postId });
  }
}
