import { describe, expect, it } from "vitest";
import { canAccessAdmin, isAdmin, parseRole } from "@/lib/auth/roles";

describe("roles", () => {
  it("parseRole defaults to user", () => {
    expect(parseRole(undefined)).toBe("user");
    expect(parseRole("unknown")).toBe("user");
  });

  it("canAccessAdmin for editor and admin", () => {
    expect(canAccessAdmin("editor")).toBe(true);
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("user")).toBe(false);
  });

  it("isAdmin only for admin", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("editor")).toBe(false);
  });
});
