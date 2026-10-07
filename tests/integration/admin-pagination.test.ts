import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import { listAllFeedPostsForAdmin } from "@/lib/feed/queries";
import {
  listAdminSessions,
  listParticipants,
  listUnpaid,
} from "@/lib/training/admin-queries";
import {
  seedPublishedAnnouncement,
  seedRegistration,
  seedUser,
} from "./helpers/seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("admin pagination", () => {
  useIntegrationDb();

  it("sessions: 10 per page, newest first, page past end → last", async () => {
    const base = Date.now() + 86_400_000;
    for (let i = 0; i < 12; i++) {
      await seedPublishedAnnouncement({
        title: `S${i}`,
        startsAt: new Date(base + i * 86_400_000),
      });
    }
    const first = await listAdminSessions("upcoming", { page: 1, size: 10 });
    expect(first.total).toBe(12);
    expect(first.pageCount).toBe(2);
    expect(first.items).toHaveLength(10);
    expect(first.items[0]?.session.title).toBe("S11");

    const last = await listAdminSessions("upcoming", { page: 99, size: 10 });
    expect(last.page).toBe(2);
    expect(last.items.map((r) => r.session.title)).toEqual(["S1", "S0"]);
  });

  it("posts: filter and pagination together", async () => {
    for (let i = 0; i < 13; i++) {
      await db.insert(feedPosts).values({
        id: `draft-${i}`,
        type: "news",
        title: `Draft ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }
    await db.insert(feedPosts).values({
      id: "live",
      type: "news",
      title: "Live",
      status: "published",
      publishedAt: new Date(Date.now() - 1000),
    });
    const drafts = await listAllFeedPostsForAdmin({
      filter: "draft",
      request: { page: 2, size: 10 },
    });
    expect(drafts.total).toBe(13);
    expect(drafts.items.map((p) => p.id)).toEqual([
      "draft-10",
      "draft-11",
      "draft-12",
    ]);
  });

  it("participants: search narrows the count", async () => {
    for (let i = 0; i < 11; i++) await seedUser(`runner-${i}`);
    await seedUser("other");
    const all = await listParticipants("", { page: 1, size: 10 });
    expect(all.total).toBe(12);
    const found = await listParticipants("runner", { page: 2, size: 10 });
    expect(found.total).toBe(11);
    expect(found.items).toHaveLength(1);
  });

  it("payments: unpaid includes past trainings, newest first", async () => {
    const userId = await seedUser("unpaid-user");
    const { sessionId: past } = await seedPublishedAnnouncement({
      title: "Past",
      startsAt: new Date(Date.now() - 86_400_000),
    });
    const { sessionId: future } = await seedPublishedAnnouncement({
      title: "Future",
      startsAt: new Date(Date.now() + 86_400_000),
    });
    const { sessionId: free } = await seedPublishedAnnouncement({
      title: "Free",
      priceCents: 0,
    });
    await seedRegistration(userId, past);
    await seedRegistration(userId, future);
    await seedRegistration(userId, free);
    const unpaid = await listUnpaid({ page: 1, size: 10 });
    expect(unpaid.items.map((r) => r.session.title)).toEqual([
      "Future",
      "Past",
    ]);
  });
});
