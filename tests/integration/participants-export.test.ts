import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { registrations, user } from "@/lib/db/schema";
import { listParticipantsForExport } from "@/lib/training/admin-queries";
import {
  seedPublishedAnnouncement,
  seedRegistration,
  seedUser,
} from "./helpers/seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("participants export", () => {
  useIntegrationDb();

  it("counts active attended visits and skips deleted users", async () => {
    await seedUser("came");
    await seedUser("none");
    await seedUser("gone");
    await db
      .update(user)
      .set({ name: "Came", email: "came@oval.local" })
      .where(eq(user.id, "came"));
    await db
      .update(user)
      .set({ name: "None", email: null })
      .where(eq(user.id, "none"));
    await db
      .update(user)
      .set({ deletedAt: new Date() })
      .where(eq(user.id, "gone"));

    const first = await seedPublishedAnnouncement({ title: "A" });
    const second = await seedPublishedAnnouncement({ title: "B" });
    const third = await seedPublishedAnnouncement({ title: "C" });
    const fourth = await seedPublishedAnnouncement({ title: "D" });
    const attended = await seedRegistration("came", first.sessionId);
    const attendedToo = await seedRegistration("came", second.sessionId);
    const missed = await seedRegistration("came", third.sessionId);
    const cancelled = await seedRegistration(
      "came",
      fourth.sessionId,
      "due",
      "cancelled",
    );
    const deletedVisit = await seedRegistration("gone", first.sessionId);

    await db
      .update(registrations)
      .set({ attendance: "attended" })
      .where(
        inArray(registrations.id, [
          attended,
          attendedToo,
          cancelled,
          deletedVisit,
        ]),
      );
    await db
      .update(registrations)
      .set({ attendance: "no_show" })
      .where(eq(registrations.id, missed));

    expect(await listParticipantsForExport()).toEqual([
      { name: "Came", email: "came@oval.local", attended: 2 },
      { name: "None", email: null, attended: 0 },
    ]);
  });
});
