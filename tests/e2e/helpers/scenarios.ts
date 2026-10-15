import { db } from "@/lib/db/client";
import {
  feedPosts,
  payments,
  registrations,
  trainingSessions,
} from "@/lib/db/schema";
import { account, user } from "@/lib/db/schema/auth-schema";

async function insertUser(params: {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
}) {
  await db.insert(user).values({
    id: params.id,
    name: params.name,
    email: params.email ?? null,
    emailVerified: Boolean(params.email),
    role: params.role ?? "user",
  });
}

async function insertTelegramAccount(userId: string, accountId: string) {
  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId,
    providerId: "telegram",
    accountId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function seedSessionWithRegistrations(options: {
  sessionId: string;
  title: string;
}) {
  const postId = crypto.randomUUID();
  await db.insert(trainingSessions).values({
    id: options.sessionId,
    title: options.title,
    startsAt: new Date("2027-06-01T18:00:00Z"),
    priceCents: 50000,
    capacity: 20,
    status: "scheduled",
    onlinePaymentEnabled: true,
  });
  await db.insert(feedPosts).values({
    id: postId,
    type: "training_announcement",
    title: options.title,
    body: "e2e",
    status: "published",
    publishedAt: new Date(),
    relatedSessionId: options.sessionId,
  });
}

async function seedRegistrationWithPendingPayment(
  userId: string,
  sessionId: string,
) {
  const registrationId = crypto.randomUUID();
  await db.insert(registrations).values({
    id: registrationId,
    userId,
    trainingSessionId: sessionId,
    status: "pending_payment",
  });
  const paymentId = crypto.randomUUID();
  await db.insert(payments).values({
    id: paymentId,
    userId,
    registrationId,
    amountCents: 50000,
    currency: "RUB",
    status: "pending",
    provider: "mock",
    externalId: `e2e_${paymentId.slice(0, 8)}`,
  });
  return registrationId;
}

export type E2eSeedScenario =
  | "email-merge-victim"
  | "admin-payment-conflict"
  | "admin-merge-success";

export type E2eSeedResult =
  | { scenario: "email-merge-victim"; victimEmail: string }
  | {
      scenario: "admin-payment-conflict";
      superAdminEmail: string;
      targetSearch: string;
      sourceSearch: string;
    }
  | {
      scenario: "admin-merge-success";
      superAdminEmail: string;
      targetSearch: string;
      sourceSearch: string;
    };

export async function seedE2eScenario(
  scenario: E2eSeedScenario,
  runId: string,
): Promise<E2eSeedResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for e2e seed helpers");
  }

  const suffix = runId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);

  if (scenario === "email-merge-victim") {
    const victimEmail = `e2e-victim-${suffix}@oval.test`;
    await insertUser({
      id: `e2e-victim-${suffix}`,
      name: "E2E Victim",
      email: victimEmail,
    });
    return { scenario, victimEmail };
  }

  if (scenario === "admin-payment-conflict") {
    const superAdminEmail = `e2e-super-${suffix}@oval.test`;
    const targetSearch = `E2E Target ${suffix}`;
    const sourceSearch = `E2E Source ${suffix}`;
    const targetId = `e2e-tgt-${suffix}`;
    const sourceId = `e2e-src-${suffix}`;
    const sessionId = `e2e-sess-${suffix}`;

    await insertUser({
      id: `e2e-super-${suffix}`,
      name: "E2E Super",
      email: superAdminEmail,
      role: "super_admin",
    });
    await insertUser({
      id: targetId,
      name: targetSearch,
      email: `e2e-target-${suffix}@oval.test`,
    });
    await insertUser({
      id: sourceId,
      name: sourceSearch,
      email: null,
    });
    await insertTelegramAccount(sourceId, `tg_${suffix}`);

    await seedSessionWithRegistrations({
      sessionId,
      title: `E2E conflict ${suffix}`,
    });
    await seedRegistrationWithPendingPayment(targetId, sessionId);
    await seedRegistrationWithPendingPayment(sourceId, sessionId);

    return {
      scenario,
      superAdminEmail,
      targetSearch,
      sourceSearch,
    };
  }

  const superAdminEmail = `e2e-super-ok-${suffix}@oval.test`;
  const targetSearch = `E2E OK Target ${suffix}`;
  const sourceSearch = `E2E OK Source ${suffix}`;
  const targetId = `e2e-ok-tgt-${suffix}`;
  const sourceId = `e2e-ok-src-${suffix}`;

  await insertUser({
    id: `e2e-super-ok-${suffix}`,
    name: "E2E Super OK",
    email: superAdminEmail,
    role: "super_admin",
  });
  await insertUser({
    id: targetId,
    name: targetSearch,
    email: `e2e-ok-target-${suffix}@oval.test`,
  });
  await insertUser({
    id: sourceId,
    name: sourceSearch,
    email: null,
  });
  await insertTelegramAccount(sourceId, `tg_ok_${suffix}`);

  return {
    scenario: "admin-merge-success",
    superAdminEmail,
    targetSearch,
    sourceSearch,
  };
}
