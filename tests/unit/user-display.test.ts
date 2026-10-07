import { describe, expect, it } from "vitest";
import { userHeaderDisplay } from "@/lib/auth/user-display";

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
