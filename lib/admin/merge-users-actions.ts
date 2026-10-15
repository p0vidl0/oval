"use server";

import { revalidatePath } from "next/cache";
import type { PageRequest } from "@/lib/admin/pagination";
import {
  getUserSummary,
  searchUsersForAdminPaged,
} from "@/lib/admin/user-queries";
import {
  findMergePaymentConflicts,
  MergeUsersError,
  mergeUsers,
} from "@/lib/auth/merge-users";
import { isSuperAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export async function searchUsersForMergeAction(query: string, page: number) {
  await requireSuperAdmin();
  const request: PageRequest = { page: Math.max(1, page), size: 10 };
  return searchUsersForAdminPaged(query, request);
}

async function requireSuperAdmin() {
  const session = await getServerSession();
  if (!session || !isSuperAdmin(session.user.role as string | undefined)) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function previewAdminUserMerge(input: {
  sourceUserId: string;
  targetUserId: string;
}) {
  await requireSuperAdmin();
  const [source, target] = await Promise.all([
    getUserSummary(input.sourceUserId),
    getUserSummary(input.targetUserId),
  ]);
  if (!source || !target) {
    return { ok: false as const, message: "Пользователь не найден" };
  }
  if (source.deletedAt || target.deletedAt) {
    return { ok: false as const, message: "Один из пользователей недоступен" };
  }
  const conflicts = await findMergePaymentConflicts(
    input.sourceUserId,
    input.targetUserId,
  );
  return {
    ok: true as const,
    source,
    target,
    paymentConflicts: conflicts,
  };
}

export async function executeAdminUserMerge(input: {
  sourceUserId: string;
  targetUserId: string;
}): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const session = await requireSuperAdmin();
  try {
    await mergeUsers({
      sourceUserId: input.sourceUserId,
      targetUserId: input.targetUserId,
      performedByUserId: session.user.id,
      kind: "super_admin",
      selfService: false,
    });
  } catch (error) {
    if (error instanceof MergeUsersError) {
      return { ok: false, message: error.message, code: error.code };
    }
    throw error;
  }
  revalidatePath("/admin/users/merge");
  revalidatePath("/admin/registrations");
  revalidatePath("/admin/payments");
  return { ok: true };
}
