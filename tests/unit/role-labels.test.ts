import { describe, expect, it } from "vitest";
import { roleLabel } from "@/lib/auth/role-labels";

describe("roleLabel", () => {
  it("maps known roles", () => {
    expect(roleLabel("user")).toBe("Участник");
    expect(roleLabel("editor")).toBe("Участник");
    expect(roleLabel("admin")).toBe("Админ");
    expect(roleLabel("super_admin")).toBe("Супер-админ");
  });
});
