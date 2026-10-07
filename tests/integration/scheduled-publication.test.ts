import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import {
  getPublishedFeedPostById,
  listAllFeedPostsForAdmin,
  listPublishedFeedPosts,
} from "@/lib/feed/queries";
import { releaseDuePosts } from "@/lib/feed/scheduled-publisher";
import {
  type FeedRealtimeEvent,
  subscribeFeedEvents,
} from "@/lib/realtime/feed-event-bus";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

async function seedNews(id: string, publishedAt: Date, pinned = false) {
  await db.insert(feedPosts).values({
    id,
    type: "news",
    title: id,
    status: "published",
    publishedAt,
    pinned,
  });
}

run("scheduled publication", () => {
  useIntegrationDb();

  it("scheduled post is hidden until its time", async () => {
    const future = new Date(Date.now() + 3600_000);
    await seedNews("later", future);
    await seedNews("now", new Date(Date.now() - 1000));

    const visible = (await listPublishedFeedPosts()).map((p) => p.id);
    expect(visible).toEqual(["now"]);
    expect(await getPublishedFeedPostById("later")).toBeNull();

    const scheduled = await listAllFeedPostsForAdmin({ filter: "scheduled" });
    expect(scheduled.items.map((p) => p.id)).toEqual(["later"]);
    const published = await listAllFeedPostsForAdmin({ filter: "published" });
    expect(published.items.map((p) => p.id)).toEqual(["now"]);
  });

  it("releaseDuePosts announces due posts and applies pin", async () => {
    const t0 = new Date(Date.now() - 60_000);
    await seedNews("old-pinned", new Date(Date.now() - 3600_000), true);
    await seedNews("due", new Date(Date.now() - 1000), true);
    await seedNews("not-yet", new Date(Date.now() + 3600_000));

    const events: FeedRealtimeEvent[] = [];
    const unsubscribe = subscribeFeedEvents((e) => events.push(e));
    const released = await releaseDuePosts(t0, new Date());
    unsubscribe();

    expect(released).toEqual(["due"]);
    expect(events).toContainEqual({
      type: "feed.post_published",
      postId: "due",
    });

    const old = await db
      .select()
      .from(feedPosts)
      .where(eq(feedPosts.id, "old-pinned"));
    expect(old[0]?.pinned).toBe(false);
  });
});
