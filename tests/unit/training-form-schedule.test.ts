import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAINING_CAPACITY,
  normalizeTimeField,
  readTrainingScheduleFromForm,
  resolveTrainingCapacity,
} from "@/lib/admin/training-form-schedule";
import {
  formatTimeHm,
  formatTimeInput,
  parseClubDateTime,
} from "@/lib/format/datetime";

describe("parseClubDateTime", () => {
  it("combines date and time in Omsk offset", () => {
    const d = parseClubDateTime("2026-10-06", "20:00");
    expect(d).not.toBeNull();
    expect(d?.toISOString()).toBe("2026-10-06T14:00:00.000Z");
  });
});

describe("readTrainingScheduleFromForm", () => {
  it("reads split fields from FormData", () => {
    const fd = new FormData();
    fd.set("training_date", "2026-10-06");
    fd.set("start_time", "20:00");
    fd.set("end_time", "21:00");
    fd.set("gather_time", "19:30");
    const { startsAt, endsAt, gatherAt } = readTrainingScheduleFromForm(fd);
    expect(startsAt?.toISOString()).toBe("2026-10-06T14:00:00.000Z");
    expect(endsAt?.toISOString()).toBe("2026-10-06T15:00:00.000Z");
    expect(gatherAt?.toISOString()).toBe("2026-10-06T13:30:00.000Z");
  });

  it("applies default times when fields are empty", () => {
    const fd = new FormData();
    fd.set("training_date", "2026-10-06");
    const { startsAt, endsAt, gatherAt } = readTrainingScheduleFromForm(fd);
    expect(formatTimeInput(startsAt)).toBe("20:00");
    expect(formatTimeInput(endsAt)).toBe("21:00");
    expect(formatTimeInput(gatherAt)).toBe("19:30");
  });
});

describe("normalizeTimeField", () => {
  it("pads and keeps 24h values", () => {
    expect(normalizeTimeField("9:05", "20:00")).toBe("09:05");
    expect(normalizeTimeField("", "19:30")).toBe("19:30");
  });
});

describe("formatTimeHm", () => {
  it("uses 24-hour clock", () => {
    const d = parseClubDateTime("2026-10-06", "20:00");
    expect(d).not.toBeNull();
    if (!d) return;
    expect(formatTimeHm(d)).toBe("20:00");
    expect(formatTimeHm(d)).not.toMatch(/AM|PM|am|pm/);
  });
});

describe("resolveTrainingCapacity", () => {
  it("defaults empty input to 25", () => {
    expect(resolveTrainingCapacity("")).toBe(DEFAULT_TRAINING_CAPACITY);
    expect(resolveTrainingCapacity("  ")).toBe(DEFAULT_TRAINING_CAPACITY);
  });

  it("parses explicit value", () => {
    expect(resolveTrainingCapacity("10")).toBe(10);
  });
});
