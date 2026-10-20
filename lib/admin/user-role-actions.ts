"use server";

import { revalidatePath } from "next/cache";
import { isAssignableRole } from "@/lib/auth/assignable-roles";
import { isSuperAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { SetUserRoleError, setUserRole } from "@/lib/auth/set-user-role";

async function requireSuperAdmin() {
  const session = await getServerSession();
  if (!session || !isSuperAdmin(session.user.role as string | undefined)) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function setUserRoleAction(input: {
  userId: string;
  role: string;
}): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  await requireSuperAdmin();

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
