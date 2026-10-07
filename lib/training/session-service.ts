/**
 * Операции над тренировками и записями (без auth / revalidate — их делают server actions).
 * Доменные данные не удаляем: тренировка только отменяется, запись меняет статус.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { savePinnedForState } from "@/lib/admin/post-pinning";
import { db } from "@/lib/db/client";
import {
  feedPosts,
  payments,
  registrations,
  trainingSessionEvents,
  trainingSessions,
} from "@/lib/db/schema";
import { livePostCondition } from "@/lib/feed/publication";
import {
  ACTIVE_REGISTRATION_STATUSES,
  type RegistrationStatus,
} from "@/lib/training/status";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TrainingSchedule = {
  startsAt: Date;
  endsAt: Date | null;
  gatherAt: Date | null;
};

export type TrainingSettings = {
  title: string;
  priceCents: number;
  capacity: number;
  registrationEnabled: boolean;
  onlinePaymentEnabled: boolean;
};

/** Что делать с постом при переносе / отмене. */
export type ChangePostMode = "publish" | "draft" | "none";

export type ChangePostInput = {
  mode: ChangePostMode;
  title: string;
  body: string;
};

export class TrainingServiceError extends Error {}

function fail(message: string): never {
  throw new TrainingServiceError(message);
}

function validateSettings(settings: TrainingSettings) {
  if (!settings.title.trim()) fail("Укажите название тренировки");
  if (!Number.isFinite(settings.priceCents) || settings.priceCents < 0) {
    fail("Некорректная цена");
  }
  if (!Number.isInteger(settings.capacity) || settings.capacity < 1) {
    fail("Некорректный лимит мест");
  }
}

async function lockSession(tx: Tx, sessionId: string) {
  const rows = await tx
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
    .for("update");
  return rows[0] ?? fail("Тренировка не найдена");
}

async function countRegistrations(
  tx: Tx,
  sessionId: string,
  statuses?: readonly RegistrationStatus[],
) {
  const rows = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(registrations)
    .where(
      and(
        eq(registrations.trainingSessionId, sessionId),
        statuses?.length
          ? inArray(registrations.status, [...statuses])
          : undefined,
      ),
    );
  return rows[0]?.count ?? 0;
}

async function insertEvent(
  tx: Tx,
  event: {
    sessionId: string;
    kind: "created" | "updated" | "rescheduled" | "cancelled";
    payload?: Record<string, unknown>;
    postId?: string | null;
    actorUserId: string | null;
  },
) {
  await tx.insert(trainingSessionEvents).values({
    id: crypto.randomUUID(),
    sessionId: event.sessionId,
    kind: event.kind,
    payload: event.payload ?? {},
    postId: event.postId ?? null,
    actorUserId: event.actorUserId,
  });
}

async function insertChangePost(
  tx: Tx,
  params: {
    type: "training_rescheduled" | "training_cancelled";
    sessionId: string;
    post: ChangePostInput;
    actorUserId: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<string | null> {
  if (params.post.mode === "none") return null;
  const id = crypto.randomUUID();
  const publish = params.post.mode === "publish";
  await tx.insert(feedPosts).values({
    id,
    type: params.type,
    title: params.post.title,
    body: params.post.body,
    status: publish ? "published" : "draft",
    publishedAt: publish ? new Date() : null,
    authorUserId: params.actorUserId,
    relatedSessionId: params.sessionId,
    meta: params.meta ?? {},
  });
  return id;
}

export async function createTrainingSession(params: {
  settings: TrainingSettings;
  schedule: TrainingSchedule;
  announcement: {
    title: string;
    body: string;
    /** `null` — черновик; в будущем — отложенная публикация. */
    publishedAt: Date | null;
    pinned: boolean;
    publishToTelegram: boolean;
  } | null;
  actorUserId: string | null;
}): Promise<{ sessionId: string; announcementPostId: string | null }> {
  validateSettings(params.settings);
  const sessionId = crypto.randomUUID();
  const announcementPostId = params.announcement ? crypto.randomUUID() : null;

  await db.transaction(async (tx) => {
    await tx.insert(trainingSessions).values({
      id: sessionId,
      title: params.settings.title.trim(),
      startsAt: params.schedule.startsAt,
      endsAt: params.schedule.endsAt,
      gatherAt: params.schedule.gatherAt,
      priceCents: params.settings.priceCents,
      capacity: params.settings.capacity,
      registrationEnabled: params.settings.registrationEnabled,
      onlinePaymentEnabled: params.settings.onlinePaymentEnabled,
    });
    if (params.announcement && announcementPostId) {
      const a = params.announcement;
      await tx.insert(feedPosts).values({
        id: announcementPostId,
        type: "training_announcement",
        title: a.title.trim() || params.settings.title.trim(),
        body: a.body,
        status: a.publishedAt ? "published" : "draft",
        publishedAt: a.publishedAt,
        authorUserId: params.actorUserId,
        relatedSessionId: sessionId,
        pinned: a.pinned,
        publishToTelegram: a.publishToTelegram,
      });
      await savePinnedForState(tx, announcementPostId, a.pinned, {
        status: a.publishedAt ? "published" : "draft",
        publishedAt: a.publishedAt,
      });
    }
    await insertEvent(tx, {
      sessionId,
      kind: "created",
      postId: announcementPostId,
      actorUserId: params.actorUserId,
    });
  });

  return { sessionId, announcementPostId };
}

/**
 * Параметры тренировки. Дату и время здесь можно менять, только пока на тренировку
 * никто не записывался и анонс не опубликован — иначе через {@link rescheduleTrainingSession}.
 */
export async function updateTrainingSettings(params: {
  sessionId: string;
  settings: TrainingSettings;
  schedule?: TrainingSchedule | null;
  actorUserId: string | null;
}) {
  validateSettings(params.settings);

  await db.transaction(async (tx) => {
    const before = await lockSession(tx, params.sessionId);
    if (before.status === "cancelled") fail("Тренировка отменена");

    const active = await countRegistrations(
      tx,
      params.sessionId,
      ACTIVE_REGISTRATION_STATUSES,
    );
    if (params.settings.capacity < active) {
      fail(`Лимит мест меньше числа записей (${active})`);
    }

    const scheduleChanged =
      params.schedule != null &&
      (params.schedule.startsAt.getTime() !== before.startsAt.getTime() ||
        (params.schedule.endsAt?.getTime() ?? null) !==
          (before.endsAt?.getTime() ?? null) ||
        (params.schedule.gatherAt?.getTime() ?? null) !==
          (before.gatherAt?.getTime() ?? null));
    if (scheduleChanged && !(await canEditScheduleInTx(tx, params.sessionId))) {
      fail("Дату и время меняйте через «Перенести»");
    }

    const next = {
      title: params.settings.title.trim(),
      priceCents: params.settings.priceCents,
      capacity: params.settings.capacity,
      registrationEnabled: params.settings.registrationEnabled,
      onlinePaymentEnabled: params.settings.onlinePaymentEnabled,
      ...(scheduleChanged && params.schedule
        ? {
            startsAt: params.schedule.startsAt,
            endsAt: params.schedule.endsAt,
            gatherAt: params.schedule.gatherAt,
          }
        : {}),
    };

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [key, value] of Object.entries(next)) {
      const prev = before[key as keyof typeof before];
      const a = prev instanceof Date ? prev.toISOString() : prev;
      const b = value instanceof Date ? value.toISOString() : value;
      if (a !== b) changes[key] = { from: a ?? null, to: b ?? null };
    }
    if (Object.keys(changes).length === 0) return;

    await tx
      .update(trainingSessions)
      .set(next)
      .where(eq(trainingSessions.id, params.sessionId));
    await insertEvent(tx, {
      sessionId: params.sessionId,
      kind: "updated",
      payload: { changes },
      actorUserId: params.actorUserId,
    });
  });
}

async function canEditScheduleInTx(tx: Tx, sessionId: string) {
  const regs = await countRegistrations(tx, sessionId);
  if (regs > 0) return false;
  const published = await tx
    .select({ id: feedPosts.id })
    .from(feedPosts)
    .where(and(eq(feedPosts.relatedSessionId, sessionId), livePostCondition()))
    .limit(1);
  return published.length === 0;
}

/** Можно ли править дату/время в «Параметрах» (без поста о переносе). */
export async function canEditScheduleDirectly(sessionId: string) {
  return db.transaction((tx) => canEditScheduleInTx(tx, sessionId));
}

export async function rescheduleTrainingSession(params: {
  sessionId: string;
  schedule: TrainingSchedule;
  post: ChangePostInput;
  actorUserId: string | null;
}): Promise<{ postId: string | null }> {
  return db.transaction(async (tx) => {
    const before = await lockSession(tx, params.sessionId);
    if (before.status === "cancelled") fail("Тренировка отменена");

    const meta = {
      previousStartsAt: before.startsAt.toISOString(),
      previousEndsAt: before.endsAt?.toISOString() ?? null,
      newStartsAt: params.schedule.startsAt.toISOString(),
      newEndsAt: params.schedule.endsAt?.toISOString() ?? null,
    };

    await tx
      .update(trainingSessions)
      .set({
        startsAt: params.schedule.startsAt,
        endsAt: params.schedule.endsAt,
        gatherAt: params.schedule.gatherAt,
      })
      .where(eq(trainingSessions.id, params.sessionId));

    const postId = await insertChangePost(tx, {
      type: "training_rescheduled",
      sessionId: params.sessionId,
      post: params.post,
      actorUserId: params.actorUserId,
      meta,
    });
    await insertEvent(tx, {
      sessionId: params.sessionId,
      kind: "rescheduled",
      payload: meta,
      postId,
      actorUserId: params.actorUserId,
    });
    return { postId };
  });
}

/**
 * Отмена тренировки: неоплаченные записи снимаются, оплаченные остаются —
 * по ним админ оформляет возврат или перенос оплаты.
 */
export async function cancelTrainingSession(params: {
  sessionId: string;
  reason: string;
  post: ChangePostInput;
  actorUserId: string | null;
}): Promise<{ postId: string | null; releasedCount: number }> {
  return db.transaction(async (tx) => {
    const before = await lockSession(tx, params.sessionId);
    if (before.status === "cancelled") fail("Тренировка уже отменена");

    const now = new Date();
    await tx
      .update(trainingSessions)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancellationReason: params.reason.trim() || null,
      })
      .where(eq(trainingSessions.id, params.sessionId));

    const released = await tx
      .update(registrations)
      .set({
        status: "cancelled",
        cancelledBy: "session_cancelled",
        updatedAt: now,
      })
      .where(
        and(
          eq(registrations.trainingSessionId, params.sessionId),
          eq(registrations.status, "pending_payment"),
        ),
      )
      .returning({ id: registrations.id });

    const postId = await insertChangePost(tx, {
      type: "training_cancelled",
      sessionId: params.sessionId,
      post: params.post,
      actorUserId: params.actorUserId,
    });
    await insertEvent(tx, {
      sessionId: params.sessionId,
      kind: "cancelled",
      payload: {
        reason: params.reason.trim() || null,
        releasedRegistrations: released.length,
      },
      postId,
      actorUserId: params.actorUserId,
    });
    return { postId, releasedCount: released.length };
  });
}

async function refundRegistrationInTx(
  tx: Tx,
  registrationId: string,
  actorUserId: string | null,
) {
  const rows = await tx
    .select()
    .from(registrations)
    .where(eq(registrations.id, registrationId))
    .for("update");
  const reg = rows[0] ?? fail("Запись не найдена");
  if (reg.status !== "paid")
    fail("Возврат возможен только по оплаченной записи");

  const now = new Date();
  await tx
    .update(registrations)
    .set({ status: "refunded", updatedAt: now })
    .where(eq(registrations.id, registrationId));

  const payRows = await tx
    .select()
    .from(payments)
    .where(eq(payments.registrationId, registrationId));
  const pay = payRows[0];
  if (pay) {
    await tx
      .update(payments)
      .set({
        status: "cancelled",
        metadata: {
          ...(pay.metadata ?? {}),
          refundedAt: now.toISOString(),
          refundedBy: actorUserId,
        },
        updatedAt: now,
      })
      .where(eq(payments.id, pay.id));
  }
  return reg.trainingSessionId;
}

async function transferRegistrationInTx(
  tx: Tx,
  fromRegistrationId: string,
  targetSessionId: string,
) {
  const fromRows = await tx
    .select()
    .from(registrations)
    .where(eq(registrations.id, fromRegistrationId))
    .for("update");
  const from = fromRows[0];
  if (!from || from.status !== "paid") {
    fail("Перенос возможен только с оплаченной записи");
  }
  if (from.trainingSessionId === targetSessionId) {
    fail("Выберите другую тренировку");
  }

  const target = await lockSession(tx, targetSessionId);
  if (target.status !== "scheduled") fail("Целевая тренировка отменена");

  const now = new Date();
  const existing = await tx
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.userId, from.userId),
        eq(registrations.trainingSessionId, targetSessionId),
      ),
    );
  const targetReg = existing[0];
  if (targetReg?.status === "paid") {
    fail("Участник уже оплатил целевую тренировку");
  }
  if (targetReg) {
    await tx
      .update(registrations)
      .set({
        status: "paid",
        cancelledBy: null,
        transferredFromRegistrationId: fromRegistrationId,
        updatedAt: now,
      })
      .where(eq(registrations.id, targetReg.id));
  } else {
    await tx.insert(registrations).values({
      id: crypto.randomUUID(),
      userId: from.userId,
      trainingSessionId: targetSessionId,
      status: "paid",
      transferredFromRegistrationId: fromRegistrationId,
    });
  }

  await tx
    .update(registrations)
    .set({ status: "transferred", updatedAt: now })
    .where(eq(registrations.id, fromRegistrationId));

  return { fromSessionId: from.trainingSessionId };
}

export async function refundRegistration(params: {
  registrationId: string;
  actorUserId: string | null;
}): Promise<{ sessionId: string }> {
  const sessionId = await db.transaction((tx) =>
    refundRegistrationInTx(tx, params.registrationId, params.actorUserId),
  );
  return { sessionId };
}

export async function transferRegistration(params: {
  registrationId: string;
  targetSessionId: string;
}): Promise<{ fromSessionId: string }> {
  return db.transaction((tx) =>
    transferRegistrationInTx(tx, params.registrationId, params.targetSessionId),
  );
}

async function paidRegistrationIds(tx: Tx, sessionId: string) {
  const rows = await tx
    .select({ id: registrations.id })
    .from(registrations)
    .where(
      and(
        eq(registrations.trainingSessionId, sessionId),
        eq(registrations.status, "paid"),
      ),
    );
  return rows.map((r) => r.id);
}

/** Возврат всем оплатившим (для отменённой тренировки). */
export async function refundAllPaid(params: {
  sessionId: string;
  actorUserId: string | null;
}): Promise<{ count: number }> {
  return db.transaction(async (tx) => {
    const ids = await paidRegistrationIds(tx, params.sessionId);
    for (const id of ids) {
      await refundRegistrationInTx(tx, id, params.actorUserId);
    }
    return { count: ids.length };
  });
}

/** Перенос оплаты всех оплативших на другую тренировку. */
export async function transferAllPaid(params: {
  sessionId: string;
  targetSessionId: string;
}): Promise<{ count: number }> {
  return db.transaction(async (tx) => {
    const ids = await paidRegistrationIds(tx, params.sessionId);
    for (const id of ids) {
      await transferRegistrationInTx(tx, id, params.targetSessionId);
    }
    return { count: ids.length };
  });
}
