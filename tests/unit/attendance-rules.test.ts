import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_GRACE_DAYS,
  attendanceWindow,
  canMarkAttendance,
} from "@/lib/domain/attendance/rules";

const H = 3600_000;
const D = 24 * H;
const startsAt = new Date("2026-06-01T15:00:00Z");

function session(extra: Partial<{ endsAt: Date; gatherAt: Date }> = {}) {
  return {
    startsAt,
    endsAt: extra.endsAt ?? null,
    gatherAt: extra.gatherAt ?? null,
    status: "scheduled" as const,
  };
}

const active = { status: "active" as const };

describe("attendanceWindow", () => {
  it("opens at gather time, or an hour before start", () => {
    const gatherAt = new Date(startsAt.getTime() - 30 * 60_000);
    expect(attendanceWindow(session({ gatherAt })).opensAt).toEqual(gatherAt);
    expect(attendanceWindow(session()).opensAt).toEqual(
      new Date(startsAt.getTime() - H),
    );
  });

  it(`closes ${ATTENDANCE_GRACE_DAYS} days after the end (ends_at or start + 2h)`, () => {
    const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
    expect(attendanceWindow(session({ endsAt })).closesAt).toEqual(
      new Date(endsAt.getTime() + ATTENDANCE_GRACE_DAYS * D),
    );
    expect(attendanceWindow(session()).closesAt).toEqual(
      new Date(startsAt.getTime() + 2 * H + ATTENDANCE_GRACE_DAYS * D),
    );
  });
});

describe("canMarkAttendance", () => {
  const at = (ms: number) => new Date(startsAt.getTime() + ms);

  it("inside the window", () => {
    expect(
      canMarkAttendance({
        registration: active,
        session: session(),
        now: at(0),
      }),
    ).toEqual({ ok: true });
  });

  it("not before the window", () => {
    expect(
      canMarkAttendance({
        registration: active,
        session: session(),
        now: at(-2 * H),
      }),
    ).toEqual({ ok: false, reason: "not_open" });
  });

  it("after the window only with markLate", () => {
    const now = at(2 * H + ATTENDANCE_GRACE_DAYS * D + 60_000);
    expect(
      canMarkAttendance({ registration: active, session: session(), now }),
    ).toEqual({ ok: false, reason: "too_late" });
    expect(
      canMarkAttendance({
        registration: active,
        session: session(),
        now,
        late: true,
      }),
    ).toEqual({ ok: true });
  });

  it("closed registration and cancelled training", () => {
    expect(
      canMarkAttendance({
        registration: { status: "cancelled" },
        session: session(),
        now: at(0),
      }),
    ).toEqual({ ok: false, reason: "closed_registration" });
    expect(
      canMarkAttendance({
        registration: active,
        session: { ...session(), status: "cancelled" },
        now: at(0),
      }),
    ).toEqual({ ok: false, reason: "session_cancelled" });
  });
});
