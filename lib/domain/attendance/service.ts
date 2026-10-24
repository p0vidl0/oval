/**
 * Отметки посещения (без auth / revalidate — их делают server actions).
 * Каждое изменение пишется в журнал записи в той же транзакции.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { registrations, trainingSessions } from "@/lib/db/schema";
import {
  ATTENDANCE_BLOCK_MESSAGES,
  canMarkAttendance,
  type MarkedAttendance,
} from "@/lib/domain/attendance/rules";
import { insertRegistrationEvents } from "@/lib/domain/registration/events";
import { initialPaymentState } from "@/lib/domain/registration/types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AttendanceResult =
  | { ok: true; sessionId: string; changed: number }
  | { ok: false; error: string };

async function lockSession(tx: Tx, sessionId: string) {
  const rows = await tx
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
    .for("update");
  return rows[0] ?? null;
}

/** Отметить или исправить. Повтор того же значения ничего не меняет. */
export async function markAttendance(params: {
  registrationId: string;
  value: MarkedAttendance;
  actorUserId: string;
  late?: boolean;
}): Promise<AttendanceResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ registration: registrations, session: trainingSessions })
      .from(registrations)
      .innerJoin(
        trainingSessions,
        eq(registrations.trainingSessionId, trainingSessions.id),
      )
      .where(eq(registrations.id, params.registrationId))
      .limit(1)
      .for("update", { of: registrations });
    const row = rows[0];
    if (!row) return { ok: false, error: "Запись не найдена" };
    const gate = canMarkAttendance({
      registration: row.registration,
      session: row.session,
      now: new Date(),
      late: params.late,
    });
    if (!gate.ok) {
      return { ok: false, error: ATTENDANCE_BLOCK_MESSAGES[gate.reason] };
    }
    const from = row.registration.attendance;
    if (from === params.value) {
      return { ok: true, sessionId: row.session.id, changed: 0 };
    }
    await tx
      .update(registrations)
      .set({
        attendance: params.value,
        attendanceMarkedAt: new Date(),
        attendanceMarkedBy: params.actorUserId,
      })
      .where(eq(registrations.id, row.registration.id));
    await insertRegistrationEvents(tx, [
      {
        registrationId: row.registration.id,
        sessionId: row.session.id,
        kind: "attendance_marked",
        payload: { from, to: params.value },
        actorUserId: params.actorUserId,
      },
    ]);
    return { ok: true, sessionId: row.session.id, changed: 1 };
  });
}

/** «Остальные не пришли»: все неотмеченные активные записи → `no_show`. */
export async function markRestNoShow(params: {
  sessionId: string;
  actorUserId: string;
  late?: boolean;
}): Promise<AttendanceResult> {
  return db.transaction(async (tx) => {
    const session = await lockSession(tx, params.sessionId);
    if (!session) return { ok: false, error: "Тренировка не найдена" };
    const gate = canMarkAttendance({
      registration: { status: "active" },
      session,
      now: new Date(),
      late: params.late,
    });
    if (!gate.ok) {
      return { ok: false, error: ATTENDANCE_BLOCK_MESSAGES[gate.reason] };
    }
    if (new Date() < session.startsAt) {
      return { ok: false, error: "Тренировка ещё не началась" };
    }
    const now = new Date();
    const updated = await tx
      .update(registrations)
      .set({
        attendance: "no_show",
        attendanceMarkedAt: now,
        attendanceMarkedBy: params.actorUserId,
      })
      .where(
        and(
          eq(registrations.trainingSessionId, session.id),
          eq(registrations.status, "active"),
          eq(registrations.attendance, "unknown"),
        ),
      )
      .returning({ id: registrations.id });
    await insertRegistrationEvents(
      tx,
      updated.map((r) => ({
        registrationId: r.id,
        sessionId: session.id,
        kind: "attendance_marked" as const,
        payload: { from: "unknown", to: "no_show", bulk: true },
        actorUserId: params.actorUserId,
      })),
    );
    return { ok: true, sessionId: session.id, changed: updated.length };
  });
}

/**
 * «Пришёл без записи»: тренер добавляет участника сразу как пришедшего, мимо
 * лимита мест и окна записи. Есть активная запись — просто отмечаем её.
 */
export async function addWalkIn(params: {
  sessionId: string;
  userId: string;
  actorUserId: string;
  late?: boolean;
}): Promise<AttendanceResult & { registrationId?: string }> {
  return db.transaction(async (tx) => {
    const session = await lockSession(tx, params.sessionId);
    if (!session) return { ok: false, error: "Тренировка не найдена" };
    const gate = canMarkAttendance({
      registration: { status: "active" },
      session,
      now: new Date(),
      late: params.late,
    });
    if (!gate.ok) {
      return { ok: false, error: ATTENDANCE_BLOCK_MESSAGES[gate.reason] };
    }
    const now = new Date();
    const existing = await tx
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.userId, params.userId),
          eq(registrations.trainingSessionId, session.id),
          eq(registrations.status, "active"),
        ),
      )
      .limit(1)
      .for("update");
    const current = existing[0];
    if (current) {
      if (current.attendance !== "attended") {
        await tx
          .update(registrations)
          .set({
            attendance: "attended",
            attendanceMarkedAt: now,
            attendanceMarkedBy: params.actorUserId,
          })
          .where(eq(registrations.id, current.id));
        await insertRegistrationEvents(tx, [
          {
            registrationId: current.id,
            sessionId: session.id,
            kind: "attendance_marked",
            payload: { from: current.attendance, to: "attended" },
            actorUserId: params.actorUserId,
          },
        ]);
      }
      return {
        ok: true,
        sessionId: session.id,
        changed: current.attendance === "attended" ? 0 : 1,
        registrationId: current.id,
      };
    }

    const id = crypto.randomUUID();
    const paymentState = initialPaymentState(session.priceCents);
    await tx.insert(registrations).values({
      id,
      userId: params.userId,
      trainingSessionId: session.id,
      status: "active",
      paymentState,
      source: "coach",
      attendance: "attended",
      attendanceMarkedAt: now,
      attendanceMarkedBy: params.actorUserId,
    });
    await insertRegistrationEvents(tx, [
      {
        registrationId: id,
        sessionId: session.id,
        kind: "created",
        payload: { paymentState, source: "coach" },
        actorUserId: params.actorUserId,
      },
      {
        registrationId: id,
        sessionId: session.id,
        kind: "attendance_marked",
        payload: { from: "unknown", to: "attended" },
        actorUserId: params.actorUserId,
      },
    ]);
    return { ok: true, sessionId: session.id, changed: 1, registrationId: id };
  });
}
