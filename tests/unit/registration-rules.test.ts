import { describe, expect, it } from "vitest";
import { isRegistrationOpen } from "@/lib/training/registration-rules";

const now = new Date("2026-06-01T12:00:00Z");

const base = {
  now,
  sessionStatus: "scheduled" as const,
  startsAt: new Date("2026-06-03T14:00:00Z"),
  registrationEnabled: true,
  registrationOpensAt: null,
  registrationClosesAt: null,
  activeCount: 0,
  capacity: 10,
  userHasActiveRegistration: false,
};

describe("isRegistrationOpen", () => {
  it("allows when window and capacity ok", () => {
    expect(isRegistrationOpen(base)).toEqual({ open: true });
  });

  it("blocks once the training has started", () => {
    expect(
      isRegistrationOpen({
        ...base,
        startsAt: new Date("2026-06-01T11:00:00Z"),
      }),
    ).toEqual({ open: false, reason: "started" });
    expect(isRegistrationOpen({ ...base, startsAt: now })).toEqual({
      open: false,
      reason: "started",
    });
  });

  it("blocks when full", () => {
    expect(
      isRegistrationOpen({ ...base, activeCount: 10, capacity: 10 }),
    ).toEqual({ open: false, reason: "full" });
  });

  it("blocks when registration not open yet", () => {
    expect(
      isRegistrationOpen({
        ...base,
        registrationOpensAt: new Date("2026-06-02T00:00:00Z"),
      }),
    ).toEqual({ open: false, reason: "registration_not_open" });
  });

  it("blocks when registration closed", () => {
    expect(
      isRegistrationOpen({
        ...base,
        registrationClosesAt: new Date("2026-06-01T00:00:00Z"),
      }),
    ).toEqual({ open: false, reason: "registration_closed" });
  });

  it("blocks when already registered", () => {
    expect(
      isRegistrationOpen({ ...base, userHasActiveRegistration: true }),
    ).toEqual({ open: false, reason: "already_registered" });
  });

  it("blocks when session not scheduled", () => {
    expect(isRegistrationOpen({ ...base, sessionStatus: "cancelled" })).toEqual(
      { open: false, reason: "not_scheduled" },
    );
  });

  it("blocks when registration disabled", () => {
    expect(isRegistrationOpen({ ...base, registrationEnabled: false })).toEqual(
      { open: false, reason: "registration_disabled" },
    );
  });

  it("allows unlimited capacity when capacity is null", () => {
    expect(
      isRegistrationOpen({
        ...base,
        capacity: null,
        activeCount: 1000,
      }),
    ).toEqual({ open: true });
  });
});
