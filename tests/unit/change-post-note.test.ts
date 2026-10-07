import { describe, expect, it } from "vitest";
import { changePostUserNote } from "@/lib/feed/feed-live-card";
import { canUserCancelRegistration } from "@/lib/training/status";

describe("changePostUserNote", () => {
  const reg = (status: string, cancelledBy: string | null = null) => ({
    status,
    cancelledBy,
  });

  it("no registration — no note", () => {
    expect(changePostUserNote("training_cancelled", null)).toBeUndefined();
  });

  it("reschedule keeps active registration", () => {
    expect(changePostUserNote("training_rescheduled", reg("paid"))).toBe(
      "Ваша запись сохранена",
    );
  });

  it("cancellation notes by registration state", () => {
    expect(changePostUserNote("training_cancelled", reg("paid"))).toMatch(
      /возврат или перенос/,
    );
    expect(
      changePostUserNote(
        "training_cancelled",
        reg("cancelled", "session_cancelled"),
      ),
    ).toBe("Ваша запись снята");
    expect(changePostUserNote("training_cancelled", reg("refunded"))).toBe(
      "Возврат оформлен",
    );
    expect(
      changePostUserNote("training_cancelled", reg("cancelled", "user")),
    ).toBeUndefined();
  });
});

describe("canUserCancelRegistration", () => {
  it("paid priced registration — only via coach", () => {
    expect(
      canUserCancelRegistration({ status: "paid" }, { priceCents: 500 }),
    ).toBe(false);
    expect(
      canUserCancelRegistration({ status: "paid" }, { priceCents: 0 }),
    ).toBe(true);
    expect(
      canUserCancelRegistration(
        { status: "pending_payment" },
        { priceCents: 500 },
      ),
    ).toBe(true);
  });
});
