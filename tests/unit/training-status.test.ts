import { describe, expect, it } from "vitest";
import { trainingDisplayStatus } from "@/lib/training/status";

const now = new Date("2026-06-01T12:00:00Z");
const future = new Date("2026-06-02T12:00:00Z");
const past = new Date("2026-05-31T12:00:00Z");

describe("trainingDisplayStatus", () => {
  it("cancelled wins over time and reschedule", () => {
    expect(
      trainingDisplayStatus({
        status: "cancelled",
        startsAt: past,
        wasRescheduled: true,
        now,
      }),
    ).toBe("cancelled");
  });

  it("past scheduled session", () => {
    expect(
      trainingDisplayStatus({
        status: "scheduled",
        startsAt: past,
        wasRescheduled: true,
        now,
      }),
    ).toBe("past");
  });

  it("upcoming: scheduled vs rescheduled", () => {
    const base = { status: "scheduled" as const, startsAt: future, now };
    expect(trainingDisplayStatus({ ...base, wasRescheduled: false })).toBe(
      "scheduled",
    );
    expect(trainingDisplayStatus({ ...base, wasRescheduled: true })).toBe(
      "rescheduled",
    );
  });
});
