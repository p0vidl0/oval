import { describe, expect, it } from "vitest";
import { authErrorText } from "@/lib/auth/auth-error-text";

describe("authErrorText", () => {
  it("translates known OTP errors", () => {
    expect(authErrorText({ code: "INVALID_OTP" }, "x")).toMatch(/Неверный код/);
    expect(authErrorText({ code: "OTP_EXPIRED" }, "x")).toMatch(/устарел/);
  });

  it("rate limit by status", () => {
    expect(authErrorText({ status: 429 }, "x")).toMatch(/Подождите/);
  });

  it("falls back to Russian default for unknown errors", () => {
    expect(authErrorText({ code: "SOMETHING" }, "Не удалось")).toBe(
      "Не удалось",
    );
  });
});
