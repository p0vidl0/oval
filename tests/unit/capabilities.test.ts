import { describe, expect, it } from "vitest";
import { CAPABILITIES, type Capability, can } from "@/lib/auth/capabilities";
import { isSuperAdmin, parseRole } from "@/lib/auth/roles";

const staff: Capability[] = [
  "admin.access",
  "sessions.manage",
  "feed.publish",
  "registrations.manage",
  "payments.refund",
  "payments.confirmMock",
  "analytics.view",
  "attendance.mark",
];

describe("roles", () => {
  it("parseRole defaults to user, including the removed editor role", () => {
    expect(parseRole(undefined)).toBe("user");
    expect(parseRole("unknown")).toBe("user");
    expect(parseRole("editor")).toBe("user");
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("super_admin")).toBe("super_admin");
  });

  it("isSuperAdmin only for super_admin", () => {
    expect(isSuperAdmin("super_admin")).toBe(true);
    expect(isSuperAdmin("admin")).toBe(false);
  });
});

describe("can", () => {
  it.each([
    "user",
    "editor",
    "unknown",
    undefined,
  ])("%s has no capabilities", (role) => {
    for (const capability of CAPABILITIES) {
      expect(can(role, capability)).toBe(false);
    }
  });

  it("admin has staff capabilities but cannot manage users or mark late", () => {
    for (const capability of CAPABILITIES) {
      expect(can("admin", capability)).toBe(staff.includes(capability));
    }
  });

  it("super_admin has every capability", () => {
    for (const capability of CAPABILITIES) {
      expect(can("super_admin", capability)).toBe(true);
    }
  });
});

describe("attendance capabilities", () => {
  it("admin marks, only super_admin marks late", () => {
    expect(can("admin", "attendance.mark")).toBe(true);
    expect(can("admin", "attendance.markLate")).toBe(false);
    expect(can("super_admin", "attendance.markLate")).toBe(true);
    expect(can("user", "attendance.mark")).toBe(false);
  });
});
