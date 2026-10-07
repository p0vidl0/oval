import { describe, expect, it } from "vitest";
import { telegramProfileFromClaims } from "@/lib/auth/telegram/verify-id-token";

describe("telegramProfileFromClaims", () => {
  it("maps id and profile fields", () => {
    expect(
      telegramProfileFromClaims({
        sub: "999",
        id: 123456789,
        given_name: "Anna",
        family_name: "K",
        preferred_username: "anna_k",
        picture: "https://cdn.example/photo.jpg",
      }),
    ).toEqual({
      id: 123456789,
      firstName: "Anna",
      lastName: "K",
      username: "anna_k",
      photoUrl: "https://cdn.example/photo.jpg",
    });
  });

  it("falls back to sub when id missing", () => {
    expect(telegramProfileFromClaims({ sub: "42", name: "Bob" })?.id).toBe(42);
  });
});
