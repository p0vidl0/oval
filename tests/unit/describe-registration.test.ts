import { describe, expect, it } from "vitest";
import type { Attendance } from "@/lib/domain/attendance/rules";
import {
  type DescribeRegistrationInput,
  describeRegistration,
  type RegistrationViewer,
} from "@/lib/domain/registration/describe";
import type {
  CancelSource,
  PaymentState,
  RegistrationStatus,
} from "@/lib/domain/registration/types";

const now = new Date("2026-06-01T12:00:00Z");
const future = new Date("2026-06-02T12:00:00Z");
const past = new Date("2026-05-31T12:00:00Z");

function view(
  overrides: {
    status?: RegistrationStatus;
    paymentState?: PaymentState;
    cancelledBy?: CancelSource | null;
    transferredFrom?: string | null;
    viewer?: RegistrationViewer;
    online?: boolean;
    startsAt?: Date;
    sessionStatus?: "scheduled" | "cancelled";
    transferTargetDate?: Date;
    attendance?: Attendance;
    attendanceLate?: boolean;
  } = {},
) {
  const input: DescribeRegistrationInput = {
    registration: {
      status: overrides.status ?? "active",
      paymentState: overrides.paymentState ?? "due",
      cancelledBy: overrides.cancelledBy ?? null,
      transferredFromRegistrationId: overrides.transferredFrom ?? null,
      attendance: overrides.attendance ?? "unknown",
    },
    session: {
      status: overrides.sessionStatus ?? "scheduled",
      priceCents: overrides.paymentState === "free" ? 0 : 50000,
      onlinePaymentEnabled: overrides.online ?? true,
      startsAt: overrides.startsAt ?? future,
      endsAt: null,
      gatherAt: null,
    },
    viewer: overrides.viewer ?? "participant",
    now,
    transferTargetDate: overrides.transferTargetDate,
    capabilities: { attendanceLate: overrides.attendanceLate },
  };
  return describeRegistration(input);
}

describe("describeRegistration: labels", () => {
  it.each<[PaymentState, boolean, RegistrationViewer, string]>([
    ["paid", true, "participant", "Оплачено"],
    ["paid", true, "staff", "Оплачено"],
    ["free", true, "participant", "Вы записаны"],
    ["free", true, "staff", "Записан"],
    ["due", true, "participant", "Ждёт оплаты"],
    ["due", false, "participant", "Оплата на месте"],
    ["due", false, "staff", "Ждёт оплаты"],
  ])("active %s (online=%s) for %s → %s", (paymentState, online, viewer, label) => {
    expect(view({ paymentState, online, viewer }).label).toBe(label);
  });

  it.each<[PaymentState, CancelSource | null, RegistrationViewer, string]>([
    ["due", "user", "participant", "Отменена вами"],
    ["due", "user", "staff", "Отменил участник"],
    ["due", "admin", "participant", "Отменена клубом"],
    ["due", "session_cancelled", "staff", "Тренировка отменена"],
    ["due", null, "staff", "Отменена"],
    ["refunded", "admin", "participant", "Возврат оформлен"],
    ["refunded", "admin", "staff", "Возврат"],
    ["moved", "transferred", "staff", "Оплата перенесена"],
  ])("cancelled %s by %s for %s → %s", (paymentState, cancelledBy, viewer, label) => {
    const v = view({ status: "cancelled", paymentState, cancelledBy, viewer });
    expect(v.label).toBe(label);
    expect(v.variant).toBe("cancelled");
    expect(v.active).toBe(false);
  });

  it("transfer target date for the participant", () => {
    expect(
      view({
        status: "cancelled",
        paymentState: "moved",
        cancelledBy: "transferred",
        transferTargetDate: new Date("2026-06-10T13:00:00Z"),
      }).label,
    ).toBe("Оплата перенесена на 10.06");
  });

  it("paid registration received by transfer", () => {
    expect(view({ paymentState: "paid", transferredFrom: "reg-1" }).label).toBe(
      "Оплата перенесена",
    );
  });

  it("due is the only active variant that is highlighted", () => {
    expect(view({ paymentState: "due" }).variant).toBe("due");
    expect(view({ paymentState: "paid" }).variant).toBe("default");
    expect(view({ paymentState: "free" }).variant).toBe("default");
  });
});

describe("describeRegistration: participant actions", () => {
  it("due online: pay online and cancel before start", () => {
    expect(view({ paymentState: "due" }).actions).toMatchObject({
      payOnline: true,
      payOnSite: false,
      cancel: true,
    });
  });

  it("due offline: pay on site", () => {
    expect(view({ paymentState: "due", online: false }).actions).toMatchObject({
      payOnline: false,
      payOnSite: true,
    });
  });

  it("paid cannot be cancelled by the participant", () => {
    expect(view({ paymentState: "paid" }).actions.cancel).toBe(false);
  });

  it("free can be cancelled before start", () => {
    expect(view({ paymentState: "free" }).actions.cancel).toBe(true);
  });

  it("nothing after start", () => {
    expect(view({ paymentState: "free", startsAt: past }).actions.cancel).toBe(
      false,
    );
  });

  it("no payment on a cancelled training", () => {
    expect(
      view({ paymentState: "due", sessionStatus: "cancelled" }).actions
        .payOnline,
    ).toBe(false);
  });

  it("never staff actions", () => {
    const { markPaid, refund, transfer } = view({
      paymentState: "paid",
    }).actions;
    expect([markPaid, refund, transfer]).toEqual([false, false, false]);
  });
});

describe("describeRegistration: staff actions", () => {
  it.each<[PaymentState, Record<string, boolean>]>([
    ["due", { markPaid: true, refund: false, transfer: false, cancel: true }],
    ["paid", { markPaid: false, refund: true, transfer: true, cancel: false }],
    ["free", { markPaid: false, refund: false, transfer: false, cancel: true }],
  ])("active %s", (paymentState, expected) => {
    expect(
      view({ paymentState, viewer: "staff", startsAt: past }).actions,
    ).toMatchObject({ ...expected, payOnline: false, payOnSite: false });
  });

  it("closed registration has no actions", () => {
    expect(
      Object.values(
        view({ status: "cancelled", paymentState: "refunded", viewer: "staff" })
          .actions,
      ).some(Boolean),
    ).toBe(false);
  });
});

describe("describeRegistration: attendance", () => {
  const hourAgo = new Date(now.getTime() - 3600_000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);

  it("participant label combines attendance and payment", () => {
    expect(
      view({ paymentState: "paid", attendance: "attended", startsAt: hourAgo })
        .label,
    ).toBe("Был · оплачено");
    expect(
      view({ paymentState: "due", attendance: "no_show", startsAt: hourAgo })
        .label,
    ).toBe("Пропустил");
    expect(
      view({ paymentState: "due", attendance: "attended", startsAt: hourAgo })
        .label,
    ).toBe("Был · ждёт оплаты");
    expect(
      view({ paymentState: "free", attendance: "attended", startsAt: hourAgo })
        .label,
    ).toBe("Был");
  });

  it("staff keeps the payment label and gets a separate attendance chip", () => {
    const v = view({
      paymentState: "paid",
      attendance: "no_show",
      viewer: "staff",
      startsAt: hourAgo,
    });
    expect(v.label).toBe("Оплачено");
    expect(v.attendance).toEqual({ value: "no_show", label: "Не пришёл" });
  });

  it("only staff can mark, inside the window", () => {
    expect(view({ startsAt: hourAgo }).actions.markAttendance).toBe(false);
    expect(
      view({ viewer: "staff", startsAt: hourAgo }).actions.markAttendance,
    ).toBe(true);
    expect(
      view({ viewer: "staff", startsAt: future }).actions.markAttendance,
    ).toBe(false);
    expect(
      view({ viewer: "staff", startsAt: weekAgo }).actions.markAttendance,
    ).toBe(false);
    expect(
      view({ viewer: "staff", startsAt: weekAgo, attendanceLate: true }).actions
        .markAttendance,
    ).toBe(true);
  });
});

describe("describeRegistration: unpaid no-show is not a debt", () => {
  const hourAgo = new Date(now.getTime() - 3600_000);

  it.each([
    "no_show",
    "excused",
  ] as const)("%s: grey «Без оплаты» for staff", (attendance) => {
    const v = view({
      paymentState: "due",
      attendance,
      viewer: "staff",
      startsAt: hourAgo,
    });
    expect(v.label).toBe("Без оплаты");
    expect(v.variant).toBe("default");
    // Оплатить всё ещё можно — из меню «…».
    expect(v.actions.markPaid).toBe(true);
  });
});
