import { describe, expect, it } from "vitest";
import type {
  CancelSource,
  PaymentState,
  RegistrationStatus,
} from "@/lib/domain/registration/types";
import { changePostUserNote } from "@/lib/feed/feed-live-card";

describe("changePostUserNote", () => {
  const reg = (
    status: RegistrationStatus,
    paymentState: PaymentState,
    cancelledBy: CancelSource | null = null,
  ) => ({ status, paymentState, cancelledBy });

  it("no registration — no note", () => {
    expect(changePostUserNote("training_cancelled", null)).toBeUndefined();
  });

  it("reschedule keeps active registration", () => {
    expect(
      changePostUserNote("training_rescheduled", reg("active", "paid")),
    ).toBe("Ваша запись сохранена");
    expect(
      changePostUserNote("training_rescheduled", reg("cancelled", "due")),
    ).toBeUndefined();
  });

  it("cancellation notes by registration state", () => {
    expect(
      changePostUserNote("training_cancelled", reg("active", "paid")),
    ).toMatch(/возврат или перенос/);
    expect(
      changePostUserNote(
        "training_cancelled",
        reg("cancelled", "due", "session_cancelled"),
      ),
    ).toBe("Ваша запись снята");
    expect(
      changePostUserNote(
        "training_cancelled",
        reg("cancelled", "refunded", "admin"),
      ),
    ).toBe("Возврат оформлен");
    expect(
      changePostUserNote(
        "training_cancelled",
        reg("cancelled", "moved", "transferred"),
      ),
    ).toBe("Оплата перенесена на другую тренировку");
    expect(
      changePostUserNote("training_cancelled", reg("cancelled", "due", "user")),
    ).toBeUndefined();
  });
});
