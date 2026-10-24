import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { trainingSessions } from "@/lib/db/schema";
import {
  listAdminSessions,
  listAttentionSessions,
  listCurrentAndNextSessions,
} from "@/lib/training/admin-queries";
import {
  seedPublishedAnnouncement,
  seedRegistration,
  seedUser,
} from "./helpers/seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

const HOUR = 3600_000;

async function seedSession(title: string, startsInHours: number, extra = {}) {
  const { sessionId } = await seedPublishedAnnouncement({
    title,
    capacity: 10,
    startsAt: new Date(Date.now() + startsInHours * HOUR),
    ...extra,
  });
  return sessionId;
}

run("admin today", () => {
  useIntegrationDb();

  it("keeps the running training first, then the next ones in order", async () => {
    await seedSession("Finished", -5);
    const running = await seedSession("Running", -1);
    await seedSession("Later", 48);
    await seedSession("Tomorrow", 24);

    const rows = await listCurrentAndNextSessions(new Date());
    expect(rows.map((r) => r.session.title)).toEqual([
      "Running",
      "Tomorrow",
      "Later",
    ]);
    expect(rows[0]?.session.id).toBe(running);
  });

  it("uses ends_at when it is set", async () => {
    const id = await seedSession("Long", -3);
    await db
      .update(trainingSessions)
      .set({ endsAt: new Date(Date.now() + HOUR) })
      .where(eq(trainingSessions.id, id));
    const rows = await listCurrentAndNextSessions(new Date());
    expect(rows[0]?.session.id).toBe(id);
  });

  it("attention: unpaid soon and paid on a cancelled training, not free", async () => {
    const user = await seedUser("attention-user");
    const soon = await seedSession("Soon unpaid", 3);
    await seedRegistration(user, soon, "due");
    const far = await seedSession("Far unpaid", 72);
    await seedRegistration(user, far, "due");
    const free = await seedSession("Soon free", 3, { priceCents: 0 });
    await seedRegistration(user, free, "free");
    const cancelled = await seedSession("Cancelled paid", 24);
    await seedRegistration(user, cancelled, "paid");
    await db
      .update(trainingSessions)
      .set({ status: "cancelled" })
      .where(eq(trainingSessions.id, cancelled));

    const rows = await listAttentionSessions(new Date());
    expect(rows.map((r) => r.session.title)).toEqual([
      "Soon unpaid",
      "Cancelled paid",
    ]);
  });

  it("upcoming schedule is sorted from the nearest", async () => {
    await seedSession("In 3 days", 72);
    await seedSession("In 1 day", 24);
    const { items } = await listAdminSessions("upcoming");
    expect(items.map((r) => r.session.title)).toEqual([
      "In 1 day",
      "In 3 days",
    ]);
  });
});
