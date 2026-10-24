import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { mergeUsers } from "@/lib/auth/merge-users";
import { db } from "@/lib/db/client";
import { registrationEvents, registrations } from "@/lib/db/schema";
import {
  addWalkIn,
  markAttendance,
  markRestNoShow,
} from "@/lib/domain/attendance/service";
import {
  getAdminSession,
  getParticipantAttendance,
  listAttentionSessions,
  listSessionRegistrationsAdmin,
  listUnpaid,
} from "@/lib/training/admin-queries";
import { countUserAttendance } from "@/lib/training/registrations";
import {
  seedPublishedAnnouncement,
  seedRegistration,
  seedUser,
} from "./helpers/seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

const H = 3600_000;

async function startedSession(hoursAgo = 1, extra = {}) {
  const { sessionId } = await seedPublishedAnnouncement({
    startsAt: new Date(Date.now() - hoursAgo * H),
    capacity: 5,
    ...extra,
  });
  return sessionId;
}

async function reg(id: string) {
  const [row] = await db
    .select()
    .from(registrations)
    .where(eq(registrations.id, id));
  return row;
}

async function attendanceEvents(registrationId: string) {
  return db
    .select()
    .from(registrationEvents)
    .where(
      and(
        eq(registrationEvents.registrationId, registrationId),
        eq(registrationEvents.kind, "attendance_marked"),
      ),
    )
    .orderBy(registrationEvents.createdAt);
}

run("attendance", () => {
  useIntegrationDb();

  it("marks and corrects with journal events; repeat is a no-op", async () => {
    const coach = await seedUser("att-coach");
    const sessionId = await startedSession();
    const regId = await seedRegistration(await seedUser("att-user"), sessionId);

    expect(
      await markAttendance({
        registrationId: regId,
        value: "attended",
        actorUserId: coach,
      }),
    ).toMatchObject({ ok: true, changed: 1 });
    expect(
      await markAttendance({
        registrationId: regId,
        value: "attended",
        actorUserId: coach,
      }),
    ).toMatchObject({ ok: true, changed: 0 });
    await markAttendance({
      registrationId: regId,
      value: "no_show",
      actorUserId: coach,
    });

    expect(await reg(regId)).toMatchObject({
      attendance: "no_show",
      attendanceMarkedBy: coach,
    });
    const events = await attendanceEvents(regId);
    expect(events.map((e) => e.payload)).toEqual([
      { from: "unknown", to: "attended" },
      { from: "attended", to: "no_show" },
    ]);
    expect(events.every((e) => e.actorUserId === coach)).toBe(true);
  });

  it("before the window and on closed registrations it refuses", async () => {
    const coach = await seedUser("att-coach-2");
    const { sessionId: future } = await seedPublishedAnnouncement({
      startsAt: new Date(Date.now() + 5 * H),
    });
    const early = await seedRegistration(await seedUser("att-early"), future);
    expect(
      await markAttendance({
        registrationId: early,
        value: "attended",
        actorUserId: coach,
      }),
    ).toEqual({ ok: false, error: "Отмечать можно со сбора" });

    const sessionId = await startedSession();
    const closed = await seedRegistration(
      await seedUser("att-closed"),
      sessionId,
      "due",
      "cancelled",
    );
    expect(
      await markAttendance({
        registrationId: closed,
        value: "attended",
        actorUserId: coach,
      }),
    ).toMatchObject({ ok: false });
  });

  it("after 3 days only with markLate", async () => {
    const coach = await seedUser("att-late-coach");
    const sessionId = await startedSession(4 * 24);
    const regId = await seedRegistration(await seedUser("att-late"), sessionId);
    expect(
      await markAttendance({
        registrationId: regId,
        value: "attended",
        actorUserId: coach,
      }),
    ).toMatchObject({ ok: false });
    expect(
      await markAttendance({
        registrationId: regId,
        value: "attended",
        actorUserId: coach,
        late: true,
      }),
    ).toMatchObject({ ok: true, changed: 1 });
  });

  it("rest no-show touches only unmarked active registrations", async () => {
    const coach = await seedUser("rest-coach");
    const sessionId = await startedSession();
    const marked = await seedRegistration(await seedUser("rest-a"), sessionId);
    const unmarked = await seedRegistration(
      await seedUser("rest-b"),
      sessionId,
    );
    const cancelled = await seedRegistration(
      await seedUser("rest-c"),
      sessionId,
      "due",
      "cancelled",
    );
    await markAttendance({
      registrationId: marked,
      value: "attended",
      actorUserId: coach,
    });

    expect(
      await markRestNoShow({ sessionId, actorUserId: coach }),
    ).toMatchObject({ ok: true, changed: 1 });
    expect((await reg(marked))?.attendance).toBe("attended");
    expect((await reg(unmarked))?.attendance).toBe("no_show");
    expect((await reg(cancelled))?.attendance).toBe("unknown");

    expect(await getAdminSession(sessionId)).toMatchObject({
      taken: 2,
      marked: 2,
      attended: 1,
    });
  });

  it("walk-in bypasses capacity and marks an existing registration", async () => {
    const coach = await seedUser("walkin-coach");
    const sessionId = await startedSession(1, { capacity: 1 });
    const regular = await seedUser("walkin-regular");
    const regularReg = await seedRegistration(regular, sessionId);
    const guest = await seedUser("walkin-guest");

    const added = await addWalkIn({
      sessionId,
      userId: guest,
      actorUserId: coach,
    });
    expect(added).toMatchObject({ ok: true, changed: 1 });
    const guestReg = await reg(added.ok ? (added.registrationId ?? "") : "");
    expect(guestReg).toMatchObject({
      status: "active",
      source: "coach",
      attendance: "attended",
      paymentState: "due",
    });

    const again = await addWalkIn({
      sessionId,
      userId: regular,
      actorUserId: coach,
    });
    expect(again).toMatchObject({ ok: true, registrationId: regularReg });
    expect((await reg(regularReg))?.attendance).toBe("attended");
    expect((await getAdminSession(sessionId))?.taken).toBe(2);
  });

  it("unpaid no-show is not counted as waiting for payment", async () => {
    const coach = await seedUser("debt-coach");
    const sessionId = await startedSession();
    const absent = await seedRegistration(
      await seedUser("debt-absent"),
      sessionId,
    );
    await seedRegistration(await seedUser("debt-present"), sessionId);
    await markAttendance({
      registrationId: absent,
      value: "no_show",
      actorUserId: coach,
    });

    expect((await getAdminSession(sessionId))?.unpaid).toBe(1);
    const unpaid = await listUnpaid({ page: 1, size: 10 });
    expect(unpaid.items.map((r) => r.registration.id)).not.toContain(absent);
    const filtered = await listSessionRegistrationsAdmin(sessionId, "unpaid");
    expect(filtered.map((r) => r.registration.id)).not.toContain(absent);
  });

  it("past training with unmarked registrations needs attention", async () => {
    const sessionId = await startedSession(5);
    await seedRegistration(await seedUser("unmarked-user"), sessionId, "free");
    const rows = await listAttentionSessions(new Date());
    expect(rows.map((r) => r.session.id)).toContain(sessionId);
  });

  it("participant attendance percent ignores excused; merge keeps marks", async () => {
    const coach = await seedUser("pct-coach");
    const userId = await seedUser("pct-user");
    const marks = ["attended", "attended", "no_show", "excused"] as const;
    for (const [i, value] of marks.entries()) {
      const sessionId = await startedSession(1 + i);
      const regId = await seedRegistration(userId, sessionId, "free");
      await markAttendance({
        registrationId: regId,
        value,
        actorUserId: coach,
      });
    }
    expect(await getParticipantAttendance(userId)).toMatchObject({
      attended: 2,
      noShow: 1,
      marked: 3,
      percent: 67,
    });

    const target = await seedUser("pct-target");
    await mergeUsers({
      sourceUserId: userId,
      targetUserId: target,
      performedByUserId: coach,
      kind: "super_admin",
      selfService: false,
    });
    expect(await getParticipantAttendance(target)).toMatchObject({
      attended: 2,
      noShow: 1,
    });
  });

  it("counts attended trainings per calendar year", async () => {
    const coach = await seedUser("year-coach");
    const userId = await seedUser("year-user");
    const year = new Date().getUTCFullYear();
    const inYear = await startedSession(2);
    const regIn = await seedRegistration(userId, inYear, "free");
    await markAttendance({
      registrationId: regIn,
      value: "attended",
      actorUserId: coach,
    });
    const lastYear = await seedPublishedAnnouncement({
      startsAt: new Date(Date.UTC(year - 1, 11, 31, 12)),
    });
    await db.insert(registrations).values({
      id: crypto.randomUUID(),
      userId,
      trainingSessionId: lastYear.sessionId,
      status: "active",
      paymentState: "free",
      attendance: "attended",
    });
    const noShowSession = await startedSession(3);
    const regNo = await seedRegistration(userId, noShowSession, "free");
    await markAttendance({
      registrationId: regNo,
      value: "no_show",
      actorUserId: coach,
    });

    expect(await countUserAttendance(userId, year)).toBe(1);
    expect(await countUserAttendance(userId, year - 1)).toBe(1);
  });

  it("existing rows default to unknown attendance and self source", async () => {
    const sessionId = await startedSession();
    const regId = await seedRegistration(await seedUser("defaults"), sessionId);
    expect(await reg(regId)).toMatchObject({
      attendance: "unknown",
      source: "self",
      attendanceMarkedAt: null,
    });
  });
});
