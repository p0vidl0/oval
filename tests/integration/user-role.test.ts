import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { type SetUserRoleError, setUserRole } from "@/lib/auth/set-user-role";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema/auth-schema";
import { insertUser } from "./helpers/auth-seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("setUserRole", () => {
  useIntegrationDb();

  it("sets user and admin", async () => {
    const id = await insertUser({ id: "role-target", role: "user" });

    await setUserRole({ userId: id, role: "admin" });
    let [row] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, id));
    expect(row?.role).toBe("admin");

    await setUserRole({ userId: id, role: "user" });
    [row] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, id));
    expect(row?.role).toBe("user");
  });

  it("no-op when role unchanged", async () => {
    const id = await insertUser({ id: "role-same", role: "admin" });
    await setUserRole({ userId: id, role: "admin" });
    const [row] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, id));
    expect(row?.role).toBe("admin");
  });

  it("rejects super_admin target", async () => {
    const id = await insertUser({ id: "role-super", role: "super_admin" });
    await expect(
      setUserRole({ userId: id, role: "admin" }),
    ).rejects.toMatchObject({
      code: "forbidden_role",
    } satisfies Partial<SetUserRoleError>);
  });

  it("not_found for missing user", async () => {
    await expect(
      setUserRole({ userId: "missing-user-id", role: "admin" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
