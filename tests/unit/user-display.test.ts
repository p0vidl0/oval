import { describe, expect, it } from "vitest";
import {
  PUBLIC_ROSTER_ANONYMOUS_LABEL,
  publicRosterLabel,
  userHeaderDisplay,
} from "@/lib/auth/user-display";

describe("publicRosterLabel", () => {
  it("shows name when visible and non-empty", () => {
    expect(
      publicRosterLabel({
        name: "Анна Петрова",
        rosterNameVisible: true,
      }),
    ).toBe("Анна Петрова");
  });

  it("uses anonymous label when hidden", () => {
    expect(
      publicRosterLabel({
        name: "Анна Петрова",
        rosterNameVisible: false,
      }),
    ).toBe(PUBLIC_ROSTER_ANONYMOUS_LABEL);
  });

  it("uses anonymous label for empty or whitespace name", () => {
    expect(publicRosterLabel({ name: "  ", rosterNameVisible: true })).toBe(
      PUBLIC_ROSTER_ANONYMOUS_LABEL,
    );
    expect(publicRosterLabel({ name: null, rosterNameVisible: true })).toBe(
      PUBLIC_ROSTER_ANONYMOUS_LABEL,
    );
  });
});

describe("userHeaderDisplay", () => {
  it("uses name when present", () => {
    expect(
      userHeaderDisplay({ name: "Анна Петрова", email: "anna@x.ru" }),
    ).toEqual({ initials: "АП", label: "Анна", isEmail: false });
  });

  it("falls back to email initial and email when name is empty", () => {
    expect(userHeaderDisplay({ name: "  ", email: "alex@mail.test" })).toEqual({
      initials: "A",
      label: "alex@mail.test",
      isEmail: true,
    });
    expect(
      userHeaderDisplay({ name: null, email: "user@mail.test" }).initials,
    ).toBe("U");
  });
});
