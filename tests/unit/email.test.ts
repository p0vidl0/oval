import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/lib/auth/email";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("accepts simple addresses", () => {
    expect(normalizeEmail("rider+club@nochnaya.ru")).toBe(
      "rider+club@nochnaya.ru",
    );
  });

  it("returns null for garbage", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("@.")).toBeNull();
  });
});
