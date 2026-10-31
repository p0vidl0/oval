import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { publicRosterLabel } from "@/lib/auth/user-display";
import { db } from "@/lib/db/client";
import { feedPosts, registrations, trainingSessions } from "@/lib/db/schema";
import { user } from "@/lib/db/schema/auth-schema";
import { describeRegistration } from "@/lib/domain/registration/describe";
import { insertRegistrationEvents } from "@/lib/domain/registration/events";
import {
  initialPaymentState,
  PAID_CANCEL_MESSAGE,
} from "@/lib/domain/registration/types";
import { livePostCondition } from "@/lib/feed/publication";
import {
  isRegistrationOpen,
  REGISTRATION_BLOCK_MESSAGES,
} from "@/lib/training/registration-rules";

/** Анонс тренировки, видимый в ленте, — для ссылки «в ленту». */
function publishedAnnouncementJoin() {
  return and(
    eq(feedPosts.relatedSessionId, trainingSessions.id),
    eq(feedPosts.type, "training_announcement"),
    livePostCondition(),
  );
}

export async function listPublicRoster(sessionId: string) {
  const rows = await db
    .select({
      registrationId: registrations.id,
      name: user.name,
      rosterNameVisible: user.rosterNameVisible,
    })
    .from(registrations)
    .innerJoin(user, eq(registrations.userId, user.id))
    .where(
      and(
        eq(registrations.trainingSessionId, sessionId),
        eq(registrations.status, "active"),
        isNull(user.deletedAt),
      ),
    )
    .orderBy(asc(registrations.createdAt));

  return rows.map((row) => ({
    id: row.registrationId,
    label: publicRosterLabel({
      name: row.name,
      rosterNameVisible: row.rosterNameVisible,
    }),
  }));
}

export async function countActiveRegistrations(sessionId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(registrations)
    .where(
      and(
        eq(registrations.trainingSessionId, sessionId),
        eq(registrations.status, "active"),
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
        eq(registrations.status, "active"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Запись пользователя на тренировку в любом статусе (для пометок «снята», «возврат»):
 * активная, иначе последняя закрытая.
 */
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
    )
    .orderBy(
      sql`${registrations.status} = 'active' desc`,
      desc(registrations.createdAt),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listUserRegistrations(userId: string) {
  return db
    .select({
      registration: registrations,
      session: trainingSessions,
      announcementPostId: feedPosts.id,
      announcementPostSlug: feedPosts.slug,
    })
    .from(registrations)
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .leftJoin(feedPosts, publishedAnnouncementJoin())
    .where(
      and(eq(registrations.userId, userId), eq(registrations.status, "active")),
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
        eq(registrations.status, "active"),
      ),
    );
  return rows[0]?.count ?? 0;
}

/** Нарушение частичного unique «одна активная запись на (user, session)». */
function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/**
 * Каждая запись — новая строка: отменённые и закрытые остаются в истории
 * (частичный unique `registrations_user_session_active_uidx`).
 */
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
      const active = await tx
        .select({ id: registrations.id })
        .from(registrations)
        .where(
          and(
            eq(registrations.userId, userId),
            eq(registrations.trainingSessionId, sessionId),
            eq(registrations.status, "active"),
          ),
        )
        .limit(1);

      const gate = isRegistrationOpen({
        now: new Date(),
        sessionStatus: s.status,
        startsAt: s.startsAt,
        registrationEnabled: s.registrationEnabled,
        registrationOpensAt: s.registrationOpensAt,
        registrationClosesAt: s.registrationClosesAt,
        activeCount,
        capacity: s.capacity,
        userHasActiveRegistration: active.length > 0,
      });

      if (!gate.open) {
        return {
          ok: false as const,
          error: REGISTRATION_BLOCK_MESSAGES[gate.reason],
        };
      }

      // Оплата на месте: запись ждёт оплаты до «Оплачено» в админке.
      const paymentState = initialPaymentState(s.priceCents);
      const needsPayment = paymentState === "due" && s.onlinePaymentEnabled;

      const id = crypto.randomUUID();
      await tx.insert(registrations).values({
        id,
        userId,
        trainingSessionId: sessionId,
        status: "active",
        paymentState,
      });
      await insertRegistrationEvents(tx, [
        {
          registrationId: id,
          sessionId,
          kind: "created",
          payload: { paymentState },
          actorUserId: userId,
        },
      ]);

      return {
        ok: true as const,
        registrationId: id,
        needsPayment,
        sessionId,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false as const, error: "Вы уже записаны" };
    }
    throw error;
  }
}

export async function listUserRegistrationHistory(userId: string) {
  return db
    .select({
      registration: registrations,
      session: trainingSessions,
      announcementPostId: feedPosts.id,
      announcementPostSlug: feedPosts.slug,
    })
    .from(registrations)
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .leftJoin(feedPosts, publishedAnnouncementJoin())
    .where(eq(registrations.userId, userId))
    .orderBy(trainingSessions.startsAt, registrations.createdAt);
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

/**
 * `participant` — правила участника (своя запись, до старта, без оплаты);
 * `staff` — снятие клубом из админки. Правила — `describeRegistration`.
 */
export type CancelActor = "participant" | "staff";

export async function cancelUserRegistration(
  registrationId: string,
  userId: string,
  actor: CancelActor,
) {
  return db.transaction(async (tx) => {
    const rows = await tx
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
      .limit(1)
      .for("update", { of: registrations });
    const row = rows[0];
    if (!row) return { ok: false as const, error: "Запись не найдена" };
    const own = row.registration.userId === userId;
    if (!own && actor !== "staff") {
      return { ok: false as const, error: "Forbidden" };
    }
    if (row.registration.status !== "active") {
      return { ok: false as const, error: "Запись уже отменена" };
    }
    const now = new Date();
    const view = describeRegistration({
      registration: row.registration,
      session: row.session,
      viewer: actor,
      now,
    });
    if (!view.actions.cancel) {
      // Деньги возвращает или переносит тренер (раздел «Оплата» в админке).
      if (row.registration.paymentState === "paid") {
        return { ok: false as const, error: PAID_CANCEL_MESSAGE };
      }
      return { ok: false as const, error: "Нельзя отменить после начала" };
    }
    const cancelledBy = own ? ("user" as const) : ("admin" as const);
    await tx
      .update(registrations)
      .set({ status: "cancelled", cancelledBy, updatedAt: now })
      .where(eq(registrations.id, registrationId));
    await insertRegistrationEvents(tx, [
      {
        registrationId,
        sessionId: row.session.id,
        kind: "cancelled",
        payload: { cancelledBy, actor },
        actorUserId: userId,
      },
    ]);
    return {
      ok: true as const,
      sessionId: row.session.id,
    };
  });
}

/** Сколько тренировок участник посетил за календарный год (для кабинета). */
export async function countUserAttendance(userId: string, year: number) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(registrations)
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .where(
      and(
        eq(registrations.userId, userId),
        eq(registrations.status, "active"),
        eq(registrations.attendance, "attended"),
        sql`${trainingSessions.startsAt} >= ${from.toISOString()}::timestamptz`,
        sql`${trainingSessions.startsAt} < ${to.toISOString()}::timestamptz`,
      ),
    );
  return rows[0]?.count ?? 0;
}
