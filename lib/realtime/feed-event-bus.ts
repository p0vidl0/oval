import { EventEmitter } from "node:events";

export type FeedRealtimeEvent =
  | {
      type: "session.registrations_changed";
      sessionId: string;
      activeCount: number;
    }
  | {
      type: "feed.post_published";
      postId: string;
    }
  | {
      type: "feed.post_updated";
      postId: string;
    }
  | {
      type: "feed.post_unpublished";
      postId: string;
    }
  | {
      type: "session.changed";
      sessionId: string;
    };

const GLOBAL_KEY = "__ovalFeedEventBus";

function getBus(): EventEmitter {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: EventEmitter;
  };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new EventEmitter();
    g[GLOBAL_KEY].setMaxListeners(100);
  }
  return g[GLOBAL_KEY];
}

export function publishFeedEvent(event: FeedRealtimeEvent): void {
  getBus().emit("feed", event);
}

export function subscribeFeedEvents(
  listener: (event: FeedRealtimeEvent) => void,
): () => void {
  const bus = getBus();
  bus.on("feed", listener);
  return () => bus.off("feed", listener);
}
