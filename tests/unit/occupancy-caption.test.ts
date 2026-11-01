import { describe, expect, it } from "vitest";
import { occupancyCaption } from "@/components/nl/feed-card/occupancy-caption";

describe("occupancyCaption", () => {
  it("keeps remaining spots while registration is open", () => {
    expect(
      occupancyCaption({ taken: 11, capacity: 25, registrationOpen: true }),
    ).toEqual({
      takenLabel: "Занято 11 из 25",
      leftLabel: "осталось 14 мест",
    });
  });

  it("shows only the participant count once registration is closed", () => {
    expect(
      occupancyCaption({ taken: 11, capacity: 25, registrationOpen: false }),
    ).toEqual({
      takenLabel: "11 участников",
      leftLabel: null,
    });
    expect(
      occupancyCaption({ taken: 1, capacity: 25, registrationOpen: false })
        .takenLabel,
    ).toBe("1 участник");
    expect(
      occupancyCaption({ taken: 22, capacity: 25, registrationOpen: false })
        .takenLabel,
    ).toBe("22 участника");
    expect(
      occupancyCaption({ taken: 0, capacity: 25, registrationOpen: false })
        .takenLabel,
    ).toBe("0 участников");
  });
});
