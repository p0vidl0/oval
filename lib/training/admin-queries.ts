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
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import {
  DEFAULT_PAGE_SIZE,
  type Paged,
  type PageRequest,
  paginate,
} from "@/lib/admin/pagination";
import { db } from "@/lib/db/client";
import { countRows } from "@/lib/db/count-rows";
import {
  feedPosts,
  payments,
  registrations,
  trainingSessionEvents,
  trainingSessions,
} from "@/lib/db/schema";
import { user } from "@/lib/db/schema/auth-schema";
import {
  ACTIVE_REGISTRATION_STATUSES,
  CLOSED_REGISTRATION_STATUSES,
  type RegistrationStatus,
} from "@/lib/training/status";

export type AdminSessionScope = "upcoming" | "past" | "cancelled";

export const ADMIN_SESSION_SCOPES: { key: AdminSessionScope; label: string }[] =
  [
    { key: "upcoming", label: "Предстоящие" },
    { key: "past", label: "Прошедшие" },
    { key: "cancelled", label: "Отменённые" },
  ];

export type ParticipantsFilter = "active" | "unpaid" | "paid" | "closed";

export const PARTICIPANTS_FILTERS: {
  key: ParticipantsFilter;
  label: string;
}[] = [
  { key: "active", label: "Записаны" },
  { key: "unpaid", label: "Ждут оплаты" },
  { key: "paid", label: "Оплатили" },
  { key: "closed", label: "Сняты" },
];

const FILTER_STATUSES: Record<ParticipantsFilter, RegistrationStatus[]> = {
  active: [...ACTIVE_REGISTRATION_STATUSES],
  unpaid: ["pending_payment"],
  paid: ["paid"],
  closed: [...CLOSED_REGISTRATION_STATUSES],
};

/** Сколько часов до старта считаем «скоро» для неоплаченных записей. */
const UNPAID_ATTENTION_HOURS = 24;

const announcementJoin = and(
  eq(feedPosts.relatedSessionId, trainingSessions.id),
  eq(feedPosts.type, "training_announcement"),
);

const sessionAggregates = {
  taken: sql<number>`count(${registrations.id}) filter (where ${registrations.status} in ('pending_payment', 'paid'))::int`,
  paid: sql<number>`count(${registrations.id}) filter (where ${registrations.status} = 'paid')::int`,
  unpaid: sql<number>`count(${registrations.id}) filter (where ${registrations.status} = 'pending_payment')::int`,
  // Оплаченные записи: сумма платежа, а для перенесённой оплаты (платёж остался
  // на исходной записи) — цена тренировки.
  collectedCents: sql<number>`coalesce(sum(coalesce(case when ${payments.status} = 'succeeded' then ${payments.amountCents} end, ${trainingSessions.priceCents})) filter (where ${registrations.status} = 'paid'), 0)::int`,
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
      // Как публикации: от новых к старым (самая поздняя дата — сверху).
      baseSessionQuery()
        .where(where)
        .orderBy(desc(trainingSessions.startsAt), desc(trainingSessions.id))
        .limit(limit)
        .offset(offset),
  );
}

/** Нужна реакция админа: оплаты на отменённой или неоплаченные перед стартом. */
export function sessionNeedsAttention(row: AdminSessionRow, now: Date) {
  if (row.session.status === "cancelled") return row.paid > 0;
  const msToStart = row.session.startsAt.getTime() - now.getTime();
  return (
    row.unpaid > 0 &&
    row.session.priceCents > 0 &&
    msToStart > 0 &&
    msToStart < UNPAID_ATTENTION_HOURS * 3600_000
  );
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
        inArray(registrations.status, FILTER_STATUSES[filter]),
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
    eq(registrations.status, "paid"),
    sql`${trainingSessions.priceCents} > 0`,
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
    eq(registrations.status, "pending_payment"),
    sql`${trainingSessions.priceCents} > 0`,
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

/** Все участники (поиск по имени или email), с числом записей. */
export async function listParticipants(query: string, request: PageRequest) {
  const q = query.trim();
  const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const where = q
    ? or(ilike(user.name, pattern), ilike(user.email, pattern))
    : undefined;
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
