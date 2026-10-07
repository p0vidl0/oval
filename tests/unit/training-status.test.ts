import { describe, expect, it } from "vitest";
import { historyStatus } from "@/lib/cabinet/history-status";
import {
  adminRegistrationStatusLabel,
  trainingDisplayStatus,
} from "@/lib/training/status";

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

describe("adminRegistrationStatusLabel", () => {
  it("distinguishes cancel sources", () => {
    const label = (
      cancelledBy: "user" | "admin" | "session_cancelled" | null,
    ) =>
      adminRegistrationStatusLabel({
        status: "cancelled",
        cancelledBy,
        priceCents: 500,
      });
    expect(label("user")).toBe("Отменил участник");
    expect(label("admin")).toBe("Отменена клубом");
    expect(label("session_cancelled")).toBe("Тренировка отменена");
    expect(label(null)).toBe("Отменена");
  });

  it("free paid registration reads as signed up", () => {
    expect(
      adminRegistrationStatusLabel({
        status: "paid",
        cancelledBy: null,
        priceCents: 0,
      }),
    ).toBe("Записан");
  });
});

describe("historyStatus (кабинет)", () => {
  const base = { cancelledBy: null, transferredFromRegistrationId: null };

  it("refunded", () => {
    expect(
      historyStatus({ registration: { ...base, status: "refunded" } }).text,
    ).toBe("Возврат оформлен");
  });

  it("transferred with target date", () => {
    const status = historyStatus({
      registration: { ...base, status: "transferred" },
      transferTargetDate: new Date("2026-06-10T13:00:00Z"),
    });
    expect(status.text).toBe("Оплата перенесена на 10.06");
    expect(status.variant).toBe("cancelled");
  });

  it("cancelled by user vs by session cancellation", () => {
    expect(
      historyStatus({
        registration: { ...base, status: "cancelled", cancelledBy: "user" },
      }).text,
    ).toBe("Отменена вами");
    expect(
      historyStatus({
        registration: {
          ...base,
          status: "cancelled",
          cancelledBy: "session_cancelled",
        },
      }).text,
    ).toBe("Тренировка отменена");
  });

  it("paid registration created by transfer", () => {
    expect(
      historyStatus({
        registration: {
          ...base,
          status: "paid",
          transferredFromRegistrationId: "reg-1",
        },
      }).text,
    ).toBe("Оплата перенесена");
  });
});
