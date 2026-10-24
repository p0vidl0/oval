/** Запросы админки по тренировкам и участникам. */
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  DEFAULT_PAGE_SIZE,
  type Paged,
  type PageRequest,
  paginate,
} from "@/lib/admin/pagination";
import { activeUserCondition } from "@/lib/auth/user-active";
import { db } from "@/lib/db/client";
import { countRows } from "@/lib/db/count-rows";
import {
  feedPosts,
  payments,
  registrationEvents,
  registrations,
  trainingSessionEvents,
  trainingSessions,
} from "@/lib/db/schema";
import { user } from "@/lib/db/schema/auth-schema";
import { ATTENDANCE_GRACE_DAYS } from "@/lib/domain/attendance/rules";

export type AdminSessionScope = "upcoming" | "past" | "cancelled";

export const ADMIN_SESSION_SCOPES: { key: AdminSessionScope; label: string }[] =
  [
    { key: "upcoming", label: "Предстоящие" },
    { key: "past", label: "Прошедшие" },
    { key: "cancelled", label: "Отменённые" },
  ];

export type ParticipantsFilter =
  | "active"
  | "unmarked"
  | "unpaid"
  | "paid"
  | "closed";

export const PARTICIPANTS_FILTERS: {
  key: ParticipantsFilter;
  label: string;
}[] = [
  { key: "active", label: "Записаны" },
  { key: "unmarked", label: "Не отмечены" },
  { key: "unpaid", label: "Ждут оплаты" },
  { key: "paid", label: "Оплатили" },
  { key: "closed", label: "Сняты" },
];

/** «Оплатили» включает бесплатные записи: по ним нечего ждать. */
const FILTER_CONDITIONS: Record<ParticipantsFilter, SQL | undefined> = {
  active: eq(registrations.status, "active"),
  unmarked: and(
    eq(registrations.status, "active"),
    eq(registrations.attendance, "unknown"),
  ),
  unpaid: and(
    eq(registrations.status, "active"),
    eq(registrations.paymentState, "due"),
    notInArray(registrations.attendance, ["no_show", "excused"]),
  ),
  paid: and(
    eq(registrations.status, "active"),
    inArray(registrations.paymentState, ["paid", "free"]),
  ),
  closed: eq(registrations.status, "cancelled"),
};

/** Сколько часов до старта считаем «скоро» для неоплаченных записей. */
const UNPAID_ATTENTION_HOURS = 24;

const announcementJoin = and(
  eq(feedPosts.relatedSessionId, trainingSessions.id),
  eq(feedPosts.type, "training_announcement"),
);

const sessionAggregates = {
  taken: sql<number>`count(${registrations.id}) filter (where ${registrations.status} = 'active')::int`,
  paid: sql<number>`count(${registrations.id}) filter (where ${registrations.status} = 'active' and ${registrations.paymentState} in ('paid', 'free'))::int`,
  // Не пришедшие без оплаты — не долг (см. `isAbsent`).
  unpaid: sql<number>`count(${registrations.id}) filter (where ${registrations.status} = 'active' and ${registrations.paymentState} = 'due' and ${registrations.attendance} not in ('no_show', 'excused'))::int`,
  /** Отмечены (был / не пришёл / уважительная) и пришли — среди активных. */
  marked: sql<number>`count(${registrations.id}) filter (where ${registrations.status} = 'active' and ${registrations.attendance} <> 'unknown')::int`,
  attended: sql<number>`count(${registrations.id}) filter (where ${registrations.status} = 'active' and ${registrations.attendance} = 'attended')::int`,
  /** Активные записи с реальными деньгами (без бесплатных). */
  paidMoney: sql<number>`count(${registrations.id}) filter (where ${registrations.status} = 'active' and ${registrations.paymentState} = 'paid')::int`,
  // Реальные деньги: сумма платежа, а для перенесённой оплаты (платёж остался
  // на исходной записи) — цена тренировки. Бесплатные записи не считаются.
  collectedCents: sql<number>`coalesce(sum(coalesce(case when ${payments.status} = 'succeeded' then ${payments.amountCents} end, ${trainingSessions.priceCents})) filter (where ${registrations.status} = 'active' and ${registrations.paymentState} = 'paid'), 0)::int`,
  wasRescheduled: sql<boolean>`exists (select 1 from ${trainingSessionEvents} where ${trainingSessionEvents.sessionId} = ${trainingSessions.id} and ${trainingSessionEvents.kind} = 'rescheduled')`,
};

function baseSessionQuery() {
  return db
    .select({
      session: trainingSessions,
      announcement: {
        id: feedPosts.id,
        status: feedPosts.status,
        publishedAt: feedPosts.publishedAt,
      },
      ...sessionAggregates,
    })
    .from(trainingSessions)
    .leftJoin(feedPosts, announcementJoin)
    .leftJoin(
      registrations,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .leftJoin(payments, eq(payments.registrationId, registrations.id))
    .groupBy(trainingSessions.id, feedPosts.id);
}

export type AdminSessionRow = Awaited<
  ReturnType<typeof baseSessionQuery>
>[number];

export async function listAdminSessions(
  scope: AdminSessionScope,
  request: PageRequest = { page: 1, size: DEFAULT_PAGE_SIZE },
): Promise<Paged<AdminSessionRow>> {
  const now = new Date();
  const where: SQL | undefined =
    scope === "cancelled"
      ? eq(trainingSessions.status, "cancelled")
      : scope === "past"
        ? and(
            eq(trainingSessions.status, "scheduled"),
            lt(trainingSessions.startsAt, now),
          )
        : and(
            eq(trainingSessions.status, "scheduled"),
            gte(trainingSessions.startsAt, now),
          );
  return paginate(
    request,
    () => countRows(trainingSessions, where),
    (limit, offset) =>
      // Предстоящие — от ближайшей; прошедшие и отменённые — от последней.
      baseSessionQuery()
        .where(where)
        .orderBy(
          ...(scope === "upcoming"
            ? [asc(trainingSessions.startsAt), asc(trainingSessions.id)]
            : [desc(trainingSessions.startsAt), desc(trainingSessions.id)]),
        )
        .limit(limit)
        .offset(offset),
  );
}

/** Сколько активных записей ещё не отмечено. */
export function unmarkedCount(row: AdminSessionRow) {
  return row.taken - row.marked;
}

/** Нужна реакция админа: оплаты на отменённой или неоплаченные перед стартом. */
export function sessionNeedsAttention(row: AdminSessionRow, now: Date) {
  if (row.session.status === "cancelled") return row.paidMoney > 0;
  const msToStart = row.session.startsAt.getTime() - now.getTime();
  return (
    row.unpaid > 0 &&
    row.session.priceCents > 0 &&
    msToStart > 0 &&
    msToStart < UNPAID_ATTENTION_HOURS * 3600_000
  );
}

/** Тренировка без `ends_at` считается идущей 2 часа после старта. */
const sessionEndsAt = sql`coalesce(${trainingSessions.endsAt}, ${trainingSessions.startsAt} + interval '2 hours')`;

/**
 * Ближайшие незавершённые тренировки, от ближайшей: идущая сейчас остаётся
 * первой до конца. Первая — карточка экрана «Сегодня», остальные — «Дальше».
 */
export async function listCurrentAndNextSessions(now: Date, limit = 4) {
  return baseSessionQuery()
    .where(
      and(
        eq(trainingSessions.status, "scheduled"),
        sql`${sessionEndsAt} >= ${now.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(asc(trainingSessions.startsAt), asc(trainingSessions.id))
    .limit(limit);
}

/**
 * Тренировки, где нужна реакция (как `sessionNeedsAttention`): оплаты на
 * отменённой или неоплаченные записи в ближайшие сутки перед стартом.
 */
export async function listAttentionSessions(now: Date, limit = 10) {
  const soon = new Date(now.getTime() + UNPAID_ATTENTION_HOURS * 3600_000);
  // Прошедшие в окне отметки (ATTENDANCE_GRACE_DAYS) с неотмеченными.
  const markFrom = new Date(
    now.getTime() - ATTENDANCE_GRACE_DAYS * 24 * 3600_000,
  );
  const unmarked = sql`${sessionAggregates.taken} - ${sessionAggregates.marked}`;
  return baseSessionQuery()
    .where(
      or(
        eq(trainingSessions.status, "cancelled"),
        and(
          eq(trainingSessions.status, "scheduled"),
          gte(trainingSessions.startsAt, now),
          lt(trainingSessions.startsAt, soon),
        ),
        and(
          eq(trainingSessions.status, "scheduled"),
          sql`${sessionEndsAt} < ${now.toISOString()}::timestamptz`,
          sql`${sessionEndsAt} >= ${markFrom.toISOString()}::timestamptz`,
        ),
      ),
    )
    .having(
      sql`(${trainingSessions.status} = 'cancelled' and ${sessionAggregates.paidMoney} > 0) or (${trainingSessions.status} = 'scheduled' and ${trainingSessions.startsAt} >= ${now.toISOString()}::timestamptz and ${sessionAggregates.unpaid} > 0) or (${trainingSessions.status} = 'scheduled' and ${sessionEndsAt} < ${now.toISOString()}::timestamptz and ${unmarked} > 0)`,
    )
    .orderBy(asc(trainingSessions.startsAt))
    .limit(limit);
}

export async function getAdminSession(sessionId: string) {
  const rows = await baseSessionQuery().where(
    eq(trainingSessions.id, sessionId),
  );
  return rows[0] ?? null;
}

export async function listSessionEvents(sessionId: string) {
  return db
    .select({
      event: trainingSessionEvents,
      actorName: user.name,
      post: {
        id: feedPosts.id,
        type: feedPosts.type,
        title: feedPosts.title,
        status: feedPosts.status,
      },
    })
    .from(trainingSessionEvents)
    .leftJoin(user, eq(user.id, trainingSessionEvents.actorUserId))
    .leftJoin(feedPosts, eq(feedPosts.id, trainingSessionEvents.postId))
    .where(eq(trainingSessionEvents.sessionId, sessionId))
    .orderBy(desc(trainingSessionEvents.createdAt));
}

/** Журнал записей тренировки: кто записался, снят, оплатил — с именем участника. */
export async function listSessionRegistrationEvents(sessionId: string) {
  const actor = alias(user, "actor");
  return db
    .select({
      event: registrationEvents,
      participant: { id: user.id, name: user.name, email: user.email },
      actor: { id: actor.id, name: actor.name },
    })
    .from(registrationEvents)
    .innerJoin(
      registrations,
      eq(registrations.id, registrationEvents.registrationId),
    )
    .innerJoin(user, eq(user.id, registrations.userId))
    .leftJoin(actor, eq(actor.id, registrationEvents.actorUserId))
    .where(eq(registrationEvents.sessionId, sessionId))
    .orderBy(desc(registrationEvents.createdAt));
}

export async function listSessionRegistrationsAdmin(
  sessionId: string,
  filter: ParticipantsFilter = "active",
) {
  return db
    .select({
      registration: registrations,
      user: { id: user.id, name: user.name, email: user.email },
      payment: payments,
    })
    .from(registrations)
    .innerJoin(user, eq(registrations.userId, user.id))
    .leftJoin(payments, eq(payments.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.trainingSessionId, sessionId),
        FILTER_CONDITIONS[filter],
      ),
    )
    .orderBy(registrations.createdAt);
}

/** Куда можно перенести оплату: будущие запланированные тренировки. */
export async function listTransferTargets(excludeSessionId?: string) {
  const rows = await db
    .select({
      id: trainingSessions.id,
      title: trainingSessions.title,
      startsAt: trainingSessions.startsAt,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.status, "scheduled"),
        gte(trainingSessions.startsAt, new Date()),
      ),
    )
    .orderBy(asc(trainingSessions.startsAt));
  return rows.filter((r) => r.id !== excludeSessionId);
}

function attentionQuery() {
  return db
    .select({
      registration: registrations,
      user: { id: user.id, name: user.name, email: user.email },
      session: trainingSessions,
    })
    .from(registrations)
    .innerJoin(user, eq(registrations.userId, user.id))
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    );
}

export type AttentionRow = Awaited<ReturnType<typeof attentionQuery>>[number];

async function countAttention(where: SQL | undefined) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(registrations)
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .where(where);
  return rows[0]?.count ?? 0;
}

/** Возвраты: оплачены на отменённых тренировках — нужен возврат или перенос. */
export async function listPaidOnCancelled(request: PageRequest) {
  const where = and(
    eq(trainingSessions.status, "cancelled"),
    eq(registrations.status, "active"),
    eq(registrations.paymentState, "paid"),
  );
  return paginate(
    request,
    () => countAttention(where),
    (limit, offset) =>
      attentionQuery()
        .where(where)
        .orderBy(desc(trainingSessions.startsAt), asc(registrations.id))
        .limit(limit)
        .offset(offset),
  );
}

/**
 * Ждут оплаты: платные записи на неотменённых тренировках, включая прошедшие
 * (оплату на месте могли не отметить). Сначала ближайшие/последние по дате.
 */
export async function listUnpaid(request: PageRequest) {
  const where = and(
    eq(trainingSessions.status, "scheduled"),
    eq(registrations.status, "active"),
    eq(registrations.paymentState, "due"),
    notInArray(registrations.attendance, ["no_show", "excused"]),
  );
  return paginate(
    request,
    () => countAttention(where),
    (limit, offset) =>
      attentionQuery()
        .where(where)
        .orderBy(desc(trainingSessions.startsAt), asc(registrations.id))
        .limit(limit)
        .offset(offset),
  );
}

/** Все участники (поиск по имени или email), с числом записей. Удалённые скрыты. */
export async function listParticipants(query: string, request: PageRequest) {
  const q = query.trim();
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const search = q
    ? or(ilike(user.name, pattern), ilike(user.email, pattern))
    : undefined;
  const where = and(activeUserCondition(), search);
  return paginate(
    request,
    () => countRows(user, where),
    (limit, offset) =>
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          registrationsCount: sql<number>`count(${registrations.id})::int`,
        })
        .from(user)
        .leftJoin(registrations, eq(registrations.userId, user.id))
        .where(where)
        .groupBy(user.id)
        .orderBy(asc(user.name), asc(user.id))
        .limit(limit)
        .offset(offset),
  );
}

export async function getParticipant(userId: string) {
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId));
  return rows[0] ?? null;
}

export async function listParticipantRegistrations(
  userId: string,
  request: PageRequest,
) {
  const where = eq(registrations.userId, userId);
  return paginate(
    request,
    () => countRows(registrations, where),
    (limit, offset) =>
      db
        .select({
          registration: registrations,
          session: trainingSessions,
          payment: payments,
        })
        .from(registrations)
        .innerJoin(
          trainingSessions,
          eq(registrations.trainingSessionId, trainingSessions.id),
        )
        .leftJoin(payments, eq(payments.registrationId, registrations.id))
        .where(where)
        .orderBy(desc(trainingSessions.startsAt), asc(registrations.id))
        .limit(limit)
        .offset(offset),
  );
}

/**
 * Посещаемость участника по отмеченным записям: процент = пришёл / (пришёл +
 * не пришёл), уважительные не считаются. Плюс последние прогулы.
 */
export async function getParticipantAttendance(userId: string) {
  const [counts] = await db
    .select({
      attended: sql<number>`count(*) filter (where ${registrations.attendance} = 'attended')::int`,
      noShow: sql<number>`count(*) filter (where ${registrations.attendance} = 'no_show')::int`,
    })
    .from(registrations)
    .where(
      and(eq(registrations.userId, userId), eq(registrations.status, "active")),
    );
  const lastNoShows = await db
    .select({
      registrationId: registrations.id,
      sessionId: trainingSessions.id,
      title: trainingSessions.title,
      startsAt: trainingSessions.startsAt,
    })
    .from(registrations)
    .innerJoin(
      trainingSessions,
      eq(registrations.trainingSessionId, trainingSessions.id),
    )
    .where(
      and(
        eq(registrations.userId, userId),
        eq(registrations.status, "active"),
        eq(registrations.attendance, "no_show"),
      ),
    )
    .orderBy(desc(trainingSessions.startsAt))
    .limit(3);
  const attended = counts?.attended ?? 0;
  const noShow = counts?.noShow ?? 0;
  const marked = attended + noShow;
  return {
    attended,
    noShow,
    marked,
    percent: marked > 0 ? Math.round((attended / marked) * 100) : null,
    lastNoShows,
  };
}
