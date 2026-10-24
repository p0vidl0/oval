"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/admin/require-capability";
import { isAssignableRole } from "@/lib/auth/assignable-roles";
import { SetUserRoleError, setUserRole } from "@/lib/auth/set-user-role";

export async function setUserRoleAction(input: {
  userId: string;
  role: string;
}): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  await requireCapability("users.manageRoles");

  if (!isAssignableRole(input.role)) {
    return { status: "error", message: "Недопустимая роль" };
  }

  try {
    await setUserRole({ userId: input.userId, role: input.role });
  } catch (error) {
    if (error instanceof SetUserRoleError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/users");
  return { status: "ok" };
}
