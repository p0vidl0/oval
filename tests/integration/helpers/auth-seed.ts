import { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { account, session, user } from "@/lib/db/schema/auth-schema";

export async function insertUser(params: {
  id?: string;
  name?: string;
  email?: string | null;
  emailVerified?: boolean;
  role?: string | null;
  banned?: boolean;
  deletedAt?: Date | null;
  mergedIntoUserId?: string | null;
}) {
  const id = params.id ?? crypto.randomUUID();
  await db.insert(user).values({
    id,
    name: params.name ?? "Test User",
    email: params.email === undefined ? `test-${id}@oval.local` : params.email,
    emailVerified: params.emailVerified ?? Boolean(params.email),
    role: params.role ?? "user",
    banned: params.banned ?? false,
    deletedAt: params.deletedAt ?? null,
    mergedIntoUserId: params.mergedIntoUserId ?? null,
  });
  return id;
}

export async function insertProviderAccount(
  userId: string,
  providerId: string,
  accountId: string,
) {
  const id = crypto.randomUUID();
  await db.insert(account).values({
    id,
    userId,
    providerId,
    accountId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function insertAuthSession(userId: string, token?: string) {
  const id = crypto.randomUUID();
  await db.insert(session).values({
    id,
    userId,
    token: token ?? `session-${id}`,
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function insertPayment(
  userId: string,
  registrationId: string,
  status: "pending" | "succeeded" | "failed" | "cancelled",
  amountCents = 1000,
) {
  const id = crypto.randomUUID();
  await db.insert(payments).values({
    id,
    userId,
    registrationId,
    amountCents,
    currency: "RUB",
    status,
    provider: "mock",
    externalId: `mock_${id.slice(0, 8)}`,
    paidAt: status === "succeeded" ? new Date() : null,
  });
  return id;
}
