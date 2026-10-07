import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedPosts, registrations, trainingSessions } from "@/lib/db/schema";
import { livePostCondition } from "@/lib/feed/publication";
import {
  isRegistrationOpen,
  REGISTRATION_BLOCK_MESSAGES,
} from "@/lib/training/registration-rules";
import {
  ACTIVE_REGISTRATION_STATUSES as ACTIVE_STATUSES,
  canUserCancelRegistration,
  isActiveRegistrationStatus,
  isClosedRegistrationStatus,
  PAID_CANCEL_MESSAGE,
} from "@/lib/training/status";

/** Анонс тренировки, видимый в ленте, — для ссылки «в ленту». */
function publishedAnnouncementJoin() {
  return and(
    eq(feedPosts.relatedSessionId, trainingSessions.id),
    eq(feedPosts.type, "training_announcement"),
    livePostCondition(),
  );
}

export async function countActiveRegistrations(sessionId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(registrations)
    .where(
      and(
        eq(registrations.trainingSessionId, sessionId),
        inArray(registrations.status, [...ACTIVE_STATUSES]),
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function getUserRegistrationForSession(
  userId: string,
  sessionId: string,
) {
  const rows = await db
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.userId, userId),
        eq(registrations.trainingSessionId, sessionId),
      ),
    );
  const reg = rows[0];
  if (!reg || !isActiveRegistrationStatus(reg.status)) return null;
  return reg;
}

/** Запись пользователя на тренировку в любом статусе (для пометок «снята», «возврат»). */
export async function getUserRegistrationAnyStatus(
  userId: string,
  sessionId: string,
) {
  const rows = await db
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.userId, userId),
        eq(registrations.trainingSessionId, sessionId),
      ),
    );
  return rows[0] ?? null;
}

export async function listUserRegistrations(userId: string) {
  return db
    .select({
      registration: registrations,
      session: trainingSessions,
      announcementPostId: feedPosts.id,
    })
    .from(registrations)
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .leftJoin(feedPosts, publishedAnnouncementJoin())
    .where(
      and(
        eq(registrations.userId, userId),
        inArray(registrations.status, [...ACTIVE_STATUSES]),
      ),
    )
    .orderBy(trainingSessions.startsAt);
}

async function countActiveRegistrationsInTx(
  tx: Pick<typeof db, "select">,
  sessionId: string,
) {
  const rows = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(registrations)
    .where(
      and(
        eq(registrations.trainingSessionId, sessionId),
        inArray(registrations.status, [...ACTIVE_STATUSES]),
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function registerUserForSession(
  userId: string,
  sessionId: string,
) {
  try {
    return await db.transaction(async (tx) => {
      const sessionRows = await tx
        .select()
        .from(trainingSessions)
        .where(eq(trainingSessions.id, sessionId))
        .for("update");
      const s = sessionRows[0];
      if (!s) {
        return { ok: false as const, error: "Тренировка не найдена" };
      }

      const activeCount = await countActiveRegistrationsInTx(tx, sessionId);
      const existing = await tx
        .select()
        .from(registrations)
        .where(
          and(
            eq(registrations.userId, userId),
            eq(registrations.trainingSessionId, sessionId),
          ),
        );
      const hasActive =
        existing[0] !== undefined &&
        isActiveRegistrationStatus(existing[0].status);

      const gate = isRegistrationOpen({
        now: new Date(),
        sessionStatus: s.status,
        startsAt: s.startsAt,
        registrationEnabled: s.registrationEnabled,
        registrationOpensAt: s.registrationOpensAt,
        registrationClosesAt: s.registrationClosesAt,
        activeCount,
        capacity: s.capacity,
        userHasActiveRegistration: hasActive,
      });

      if (!gate.open) {
        return {
          ok: false as const,
          error: REGISTRATION_BLOCK_MESSAGES[gate.reason],
        };
      }

      const isFree = s.priceCents <= 0;
      // Оплата на месте: запись pending_payment до «Оплачено» в админке.
      const initialStatus = isFree
        ? ("paid" as const)
        : ("pending_payment" as const);
      const needsPayment = !isFree && s.onlinePaymentEnabled;

      if (existing[0] && isClosedRegistrationStatus(existing[0].status)) {
        await tx
          .update(registrations)
          .set({
            status: initialStatus,
            cancelledBy: null,
            transferredFromRegistrationId: null,
            updatedAt: new Date(),
          })
          .where(eq(registrations.id, existing[0].id));
        return {
          ok: true as const,
          registrationId: existing[0].id,
          needsPayment,
          sessionId,
        };
      }

      const id = crypto.randomUUID();
      await tx.insert(registrations).values({
        id,
        userId,
        trainingSessionId: sessionId,
        status: initialStatus,
      });

      return {
        ok: true as const,
        registrationId: id,
        needsPayment,
        sessionId,
      };
    });
  } catch {
    return { ok: false as const, error: "Вы уже записаны" };
  }
}

export async function listUserRegistrationHistory(userId: string) {
  return db
    .select({
      registration: registrations,
      session: trainingSessions,
      announcementPostId: feedPosts.id,
    })
    .from(registrations)
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .leftJoin(feedPosts, publishedAnnouncementJoin())
    .where(eq(registrations.userId, userId))
    .orderBy(trainingSessions.startsAt);
}

/** Куда перенесли оплату с исходной записи (если есть). */
export async function getTransferTargetsBySourceRegistrationIds(
  sourceRegistrationIds: string[],
) {
  if (sourceRegistrationIds.length === 0) {
    return new Map<string, Date>();
  }
  const rows = await db
    .select({
      fromId: registrations.transferredFromRegistrationId,
      startsAt: trainingSessions.startsAt,
    })
    .from(registrations)
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .where(
      inArray(
        registrations.transferredFromRegistrationId,
        sourceRegistrationIds,
      ),
    );

  const map = new Map<string, Date>();
  for (const row of rows) {
    if (row.fromId && !map.has(row.fromId)) {
      map.set(row.fromId, row.startsAt);
    }
  }
  return map;
}

export async function cancelUserRegistration(
  registrationId: string,
  userId: string,
  isAdmin: boolean,
) {
  const rows = await db
    .select({
      registration: registrations,
      session: trainingSessions,
    })
    .from(registrations)
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .where(eq(registrations.id, registrationId))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false as const, error: "Запись не найдена" };
  if (row.registration.userId !== userId && !isAdmin) {
    return { ok: false as const, error: "Forbidden" };
  }
  if (!isActiveRegistrationStatus(row.registration.status)) {
    return { ok: false as const, error: "Запись уже отменена" };
  }
  const now = new Date();
  if (!isAdmin && now >= row.session.startsAt) {
    return { ok: false as const, error: "Нельзя отменить после начала" };
  }
  // Деньги возвращает или переносит тренер (раздел «Оплата» в админке).
  if (!isAdmin && !canUserCancelRegistration(row.registration, row.session)) {
    return { ok: false as const, error: PAID_CANCEL_MESSAGE };
  }
  const cancelledBy =
    row.registration.userId === userId ? ("user" as const) : ("admin" as const);
  await db
    .update(registrations)
    .set({ status: "cancelled", cancelledBy, updatedAt: now })
    .where(eq(registrations.id, registrationId));
  return {
    ok: true as const,
    sessionId: row.session.id,
  };
}
