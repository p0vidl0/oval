import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AuthProviderId } from "@/lib/auth/providers";
import { db } from "@/lib/db/client";
import { verification } from "@/lib/db/schema/auth-schema";

const PREFIX = "account-link:";

export type AccountLinkIntentRecord = {
  targetUserId: string;
  providerId: AuthProviderId;
  /** Set after provider proof (telegram id, vk id, email). */
  externalAccountId?: string;
  externalProfile?: {
    name?: string;
    email?: string | null;
    image?: string | null;
  };
  /** Other user that owns this provider today (merge candidate). */
  sourceUserId?: string;
  status: "pending" | "awaiting_merge_confirm";
};

function identifier(token: string): string {
  return `${PREFIX}${token}`;
}

export async function createAccountLinkIntent(input: {
  targetUserId: string;
  providerId: AuthProviderId;
  ttlSec?: number;
}): Promise<{ token: string; expiresIn: number }> {
  const ttlSec = input.ttlSec ?? 600;
  const token = randomBytes(24).toString("base64url");
  const value: AccountLinkIntentRecord = {
    targetUserId: input.targetUserId,
    providerId: input.providerId,
    status: "pending",
  };
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: identifier(token),
    value: JSON.stringify(value),
    expiresAt: new Date(Date.now() + ttlSec * 1000),
  });
  return { token, expiresIn: ttlSec };
}

export async function getAccountLinkIntent(
  token: string,
): Promise<(AccountLinkIntentRecord & { id: string }) | null> {
  const rows = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier(token)))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt <= new Date()) return null;
  try {
    const parsed = JSON.parse(row.value) as AccountLinkIntentRecord;
    return { ...parsed, id: row.id };
  } catch {
    return null;
  }
}

export async function updateAccountLinkIntent(
  token: string,
  patch: Partial<AccountLinkIntentRecord>,
): Promise<AccountLinkIntentRecord | null> {
  const current = await getAccountLinkIntent(token);
  if (!current) return null;
  const next: AccountLinkIntentRecord = {
    targetUserId: current.targetUserId,
    providerId: current.providerId,
    status: current.status,
    externalAccountId: current.externalAccountId,
    externalProfile: current.externalProfile,
    sourceUserId: current.sourceUserId,
    ...patch,
  };
  await db
    .update(verification)
    .set({ value: JSON.stringify(next), updatedAt: new Date() })
    .where(eq(verification.id, current.id));
  return next;
}

export async function consumeAccountLinkIntent(
  token: string,
): Promise<AccountLinkIntentRecord | null> {
  const current = await getAccountLinkIntent(token);
  if (!current) return null;
  await db.delete(verification).where(eq(verification.id, current.id));
  const { id: _id, ...record } = current;
  return record;
}
