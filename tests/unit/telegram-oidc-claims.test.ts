import { describe, expect, it } from "vitest";
import { decideLegacyTelegramAdopt } from "@/lib/auth/telegram/adopt-legacy-account";
import {
  legacyOidcAccountId,
  telegramProfileFromClaims,
} from "@/lib/auth/telegram/verify-id-token";

describe("telegramProfileFromClaims", () => {
  it("maps the numeric Telegram id and keeps a different sub as a legacy key", () => {
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
      legacyAccountId: "999",
    });
  });

  it("accepts id as a numeric string", () => {
    expect(
      telegramProfileFromClaims({
        sub: "1234123412341234123",
        id: "987654321",
        name: "John Doe",
      }),
    ).toMatchObject({
      id: 987654321,
      firstName: "John",
      legacyAccountId: legacyOidcAccountId("1234123412341234123", 987654321),
    });
  });

  it("omits the legacy key when Number(sub) is already the user id", () => {
    expect(
      telegramProfileFromClaims({ sub: "42", id: 42, name: "Bob" })
        ?.legacyAccountId,
    ).toBeUndefined();
  });

  it("rejects a token without the Telegram user id", () => {
    expect(telegramProfileFromClaims({ sub: "42", name: "Bob" })).toBeNull();
  });

  it("rejects an id that does not fit in a safe integer", () => {
    expect(
      telegramProfileFromClaims({
        sub: "1",
        id: "1234123412341234123",
      }),
    ).toBeNull();
  });
});

describe("legacyOidcAccountId", () => {
  it("stores the same rounded number the old sign-in wrote", () => {
    expect(legacyOidcAccountId("1234123412341234123", 987654321)).toBe(
      String(Number("1234123412341234123")),
    );
  });
});

describe("decideLegacyTelegramAdopt", () => {
  it("rebinds the single legacy row when the real id is free", () => {
    expect(
      decideLegacyTelegramAdopt({
        canonicalAccountId: "987654321",
        legacyAccountId: "1234123412341234200",
        canonicalTaken: false,
        legacyRowIds: ["row-1"],
      }),
    ).toEqual({ action: "rebind", rowId: "row-1" });
  });

  it("leaves the legacy user in place when the real id is already taken", () => {
    expect(
      decideLegacyTelegramAdopt({
        canonicalAccountId: "987654321",
        legacyAccountId: "1234123412341234200",
        canonicalTaken: true,
        legacyRowIds: ["row-1"],
      }),
    ).toEqual({ action: "skip" });
  });

  it("does not rebind when the legacy key matches more than one row", () => {
    expect(
      decideLegacyTelegramAdopt({
        canonicalAccountId: "987654321",
        legacyAccountId: "1234123412341234200",
        canonicalTaken: false,
        legacyRowIds: ["row-1", "row-2"],
      }),
    ).toEqual({ action: "skip" });
  });
});
