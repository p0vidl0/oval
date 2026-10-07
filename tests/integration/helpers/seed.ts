import { db } from "@/lib/db/client";
import {
  feedPosts,
  payments,
  registrations,
  trainingSessions,
  user,
} from "@/lib/db/schema";
import type { RegistrationStatus } from "@/lib/training/status";

export async function seedUser(id = "test-user-1") {
  await db
    .insert(user)
    .values({
      id,
      name: "Test User",
      email: `test-${id}@oval.local`,
      emailVerified: true,
      role: "user",
    })
    .onConflictDoNothing({ target: user.id });
  return id;
}

export async function seedPublishedAnnouncement(options?: {
  priceCents?: number;
  capacity?: number | null;
  sessionId?: string;
  postId?: string;
  onlinePaymentEnabled?: boolean;
  title?: string;
  startsAt?: Date;
}) {
  const postId = options?.postId ?? crypto.randomUUID();
  const sessionId = options?.sessionId ?? crypto.randomUUID();
  const priceCents = options?.priceCents ?? 50000;
  const capacity = options?.capacity ?? 2;

  await db.insert(trainingSessions).values({
    id: sessionId,
    title: options?.title ?? "Integration test session",
    startsAt: options?.startsAt ?? new Date("2027-01-15T18:00:00Z"),
    priceCents,
    capacity,
    status: "scheduled",
    onlinePaymentEnabled: options?.onlinePaymentEnabled ?? true,
  });

  await db.insert(feedPosts).values({
    id: postId,
    type: "training_announcement",
    title: options?.title ?? "Integration test session",
    body: "body",
    status: "published",
    publishedAt: new Date(),
    relatedSessionId: sessionId,
  });

  return { postId, sessionId };
}

export async function seedRegistration(
  userId: string,
  sessionId: string,
  status: RegistrationStatus = "pending_payment",
) {
  const id = crypto.randomUUID();
  await db.insert(registrations).values({
    id,
    userId,
    trainingSessionId: sessionId,
    status,
  });
  return id;
}

export async function seedPendingPayment(
  userId: string,
  registrationId: string,
  amountCents: number,
) {
  const id = crypto.randomUUID();
  await db.insert(payments).values({
    id,
    userId,
    registrationId,
    amountCents,
    currency: "RUB",
    status: "pending",
    provider: "mock",
    externalId: `mock_${id.slice(0, 8)}`,
  });
  return id;
}
