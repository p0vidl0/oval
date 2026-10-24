import { describe, expect, it } from "vitest";
import { isAssignableRole } from "@/lib/auth/assignable-roles";
import { SetUserRoleError } from "@/lib/auth/set-user-role";

describe("set-user-role helpers", () => {
  it("isAssignableRole accepts user and admin only", () => {
    expect(isAssignableRole("user")).toBe(true);
    expect(isAssignableRole("editor")).toBe(false);
    expect(isAssignableRole("admin")).toBe(true);
    expect(isAssignableRole("super_admin")).toBe(false);
    expect(isAssignableRole("unknown")).toBe(false);
  });

  it("SetUserRoleError carries code", () => {
    const err = new SetUserRoleError("msg", "forbidden_role");
    expect(err.code).toBe("forbidden_role");
    expect(err.message).toBe("msg");
  });
});
