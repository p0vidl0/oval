import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import {
  getFeedPostBySlug,
  getPublishedFeedPostBySlug,
} from "@/lib/feed/queries";
import { allocatePostSlug, postSlugDay } from "@/lib/feed/slug";
import { insertFeedPost } from "@/tests/helpers/insert-feed-post";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("feed post slug allocation", () => {
  useIntegrationDb();

  it("assigns base slug then -2, -3 on the same club day", async () => {
    const at = new Date("2024-04-10T15:00:00+06:00");
    const day = postSlugDay(at);
    expect(day).toBe("2024-04-10");

    const first = await db.transaction((tx) => allocatePostSlug(tx, at));
    expect(first).toBe("2024-04-10");

    await insertFeedPost({
      id: "slug-first",
      type: "news",
      title: "First",
      status: "published",
      publishedAt: at,
    });

    const second = await db.transaction((tx) => allocatePostSlug(tx, at));
    expect(second).toBe("2024-04-10-2");

    await insertFeedPost({
      id: "slug-second",
      type: "news",
      title: "Second",
      status: "published",
      publishedAt: at,
    });

    const third = await db.transaction((tx) => allocatePostSlug(tx, at));
    expect(third).toBe("2024-04-10-3");
  });

  it("resolves live posts by slug; drafts stay hidden", async () => {
    const at = new Date("2024-05-20T10:00:00+06:00");
    const slug = await insertFeedPost({
      id: "slug-live",
      type: "news",
      title: "Live by slug",
      status: "published",
      publishedAt: at,
    });

    const draftSlug = await insertFeedPost({
      id: "slug-draft",
      type: "news",
      title: "Draft",
      status: "draft",
      createdAt: at,
    });

    expect(await getFeedPostBySlug(slug)).toMatchObject({
      id: "slug-live",
      slug,
    });
    expect(await getPublishedFeedPostBySlug(slug)).toMatchObject({
      title: "Live by slug",
    });
    expect(await getPublishedFeedPostBySlug(draftSlug)).toBeNull();
  });
});
