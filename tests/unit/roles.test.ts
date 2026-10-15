import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  isAdmin,
  isSuperAdmin,
  parseRole,
} from "@/lib/auth/roles";

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

  it("isAdmin for admin and super_admin", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("super_admin")).toBe(true);
    expect(isAdmin("editor")).toBe(false);
  });

  it("isSuperAdmin only for super_admin", () => {
    expect(isSuperAdmin("super_admin")).toBe(true);
    expect(isSuperAdmin("admin")).toBe(false);
  });

  it("canAccessAdmin includes super_admin", () => {
    expect(canAccessAdmin("super_admin")).toBe(true);
  });
});
