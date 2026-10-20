import { eq } from "drizzle-orm";
import type { AssignableRole } from "@/lib/auth/assignable-roles";
import { parseRole } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema/auth-schema";

export type SetUserRoleErrorCode = "not_found" | "forbidden_role";

export class SetUserRoleError extends Error {
  constructor(
    message: string,
    readonly code: SetUserRoleErrorCode,
  ) {
    super(message);
    this.name = "SetUserRoleError";
  }
}

export async function setUserRole(input: {
  userId: string;
  role: AssignableRole;
}): Promise<void> {
  const [row] = await db
    .select({ id: user.id, role: user.role, deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);

  if (!row || row.deletedAt) {
    throw new SetUserRoleError("Пользователь не найден", "not_found");
  }

  if (parseRole(row.role) === "super_admin") {
    throw new SetUserRoleError(
      "Роль супер-админа нельзя менять",
      "forbidden_role",
    );
  }

  if (parseRole(row.role) === input.role) {
    return;
  }

  await db
    .update(user)
    .set({ role: input.role })
    .where(eq(user.id, input.userId));
}
