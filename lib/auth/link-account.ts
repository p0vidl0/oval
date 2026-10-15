import { and, eq } from "drizzle-orm";
import { AUTH_PROVIDER_IDS } from "@/lib/auth/providers";
import { isUserDeleted } from "@/lib/auth/user-active";
import { db } from "@/lib/db/client";
import { account, user } from "@/lib/db/schema/auth-schema";

export type AttachAccountInput = {
  targetUserId: string;
  providerId: string;
  accountId: string;
  email?: string | null;
  image?: string | null;
  name?: string;
};

export type AttachAccountResult =
  | { action: "attached" }
  | { action: "merge_required"; sourceUserId: string; sourceName: string }
  | { action: "already_linked" };

export async function resolveAttachAccount(
  input: AttachAccountInput,
): Promise<AttachAccountResult> {
  const [existingAccount] = await db
    .select({ userId: account.userId })
    .from(account)
    .where(
      and(
        eq(account.providerId, input.providerId),
        eq(account.accountId, input.accountId),
      ),
    )
    .limit(1);

  if (existingAccount) {
    if (existingAccount.userId === input.targetUserId) {
      return { action: "already_linked" };
    }
    const [sourceUser] = await db
      .select({ id: user.id, name: user.name, deletedAt: user.deletedAt })
      .from(user)
      .where(eq(user.id, existingAccount.userId))
      .limit(1);
    if (!sourceUser || isUserDeleted(sourceUser)) {
      throw new Error("Account owner not found");
    }
    return {
      action: "merge_required",
      sourceUserId: sourceUser.id,
      sourceName: sourceUser.name?.trim() || "Участник",
    };
  }

  if (input.providerId === AUTH_PROVIDER_IDS.email && input.email) {
    const [emailUser] = await db
      .select({ id: user.id, name: user.name, deletedAt: user.deletedAt })
      .from(user)
      .where(eq(user.email, input.email))
      .limit(1);
    if (emailUser && emailUser.id !== input.targetUserId) {
      if (isUserDeleted(emailUser)) {
        throw new Error("Email owner not found");
      }
      return {
        action: "merge_required",
        sourceUserId: emailUser.id,
        sourceName: emailUser.name?.trim() || "Участник",
      };
    }
  }

  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId: input.targetUserId,
    providerId: input.providerId,
    accountId: input.accountId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const targetPatch: Partial<typeof user.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.email?.trim()) {
    targetPatch.email = input.email.trim();
    targetPatch.emailVerified = true;
  }
  if (input.image?.trim()) {
    const [current] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, input.targetUserId))
      .limit(1);
    if (!current?.image?.trim()) {
      targetPatch.image = input.image.trim();
    }
  }
  if (input.name?.trim()) {
    const [current] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, input.targetUserId))
      .limit(1);
    if (!current?.name?.trim()) {
      targetPatch.name = input.name.trim();
    }
  }
  if (Object.keys(targetPatch).length > 1) {
    await db
      .update(user)
      .set(targetPatch)
      .where(eq(user.id, input.targetUserId));
  }

  return { action: "attached" };
}

export async function attachEmailToUser(
  targetUserId: string,
  email: string,
): Promise<AttachAccountResult> {
  const normalized = email.trim().toLowerCase();
  const [emailUser] = await db
    .select({ id: user.id, name: user.name, deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);

  if (emailUser && emailUser.id !== targetUserId) {
    if (isUserDeleted(emailUser)) {
      throw new Error("Email owner not found");
    }
    return {
      action: "merge_required",
      sourceUserId: emailUser.id,
      sourceName: emailUser.name?.trim() || "Участник",
    };
  }

  const [target] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);
  if (target?.email?.trim() === normalized) {
    return { action: "already_linked" };
  }

  await db
    .update(user)
    .set({
      email: normalized,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(user.id, targetUserId));

  return { action: "attached" };
}

export async function unlinkAuthMethod(input: {
  userId: string;
  providerId: string;
}): Promise<
  { ok: true } | { ok: false; reason: "last_method" | "not_linked" }
> {
  const { countAuthMethods } = await import("@/lib/auth/linked-accounts");
  const count = await countAuthMethods(input.userId);
  if (count <= 1) {
    return { ok: false, reason: "last_method" };
  }

  if (input.providerId === AUTH_PROVIDER_IDS.email) {
    const [row] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!row?.email?.trim()) {
      return { ok: false, reason: "not_linked" };
    }
    await db
      .update(user)
      .set({ email: null, emailVerified: false, updatedAt: new Date() })
      .where(eq(user.id, input.userId));
    await db
      .delete(account)
      .where(
        and(
          eq(account.userId, input.userId),
          eq(account.providerId, AUTH_PROVIDER_IDS.email),
        ),
      );
    return { ok: true };
  }

  const deleted = await db
    .delete(account)
    .where(
      and(
        eq(account.userId, input.userId),
        eq(account.providerId, input.providerId),
      ),
    )
    .returning({ id: account.id });
  if (deleted.length === 0) {
    return { ok: false, reason: "not_linked" };
  }
  return { ok: true };
}
