import { describe, expect, it } from "vitest";
import { isUserDeleted } from "@/lib/auth/user-active";

describe("isUserDeleted", () => {
  it("true when deletedAt is set", () => {
    expect(isUserDeleted({ deletedAt: new Date() })).toBe(true);
  });

  it("false when deletedAt is null or missing", () => {
    expect(isUserDeleted({ deletedAt: null })).toBe(false);
    expect(isUserDeleted(null)).toBe(false);
  });
});
