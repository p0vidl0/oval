"use server";

import type { PageRequest } from "@/lib/admin/pagination";
import { requireCapability } from "@/lib/admin/require-capability";
import { searchUsersForAdminPaged } from "@/lib/admin/user-queries";
import { applyRegistrationEffects } from "@/lib/app/effects";
import { can } from "@/lib/auth/capabilities";
import {
  ATTENDANCE_VALUES,
  type MarkedAttendance,
} from "@/lib/domain/attendance/rules";
import {
  type AttendanceResult,
  addWalkIn,
  markAttendance,
  markRestNoShow,
} from "@/lib/domain/attendance/service";

export type AttendanceActionResult =
  | { status: "ok"; changed: number }
  | { status: "error"; message: string };

async function requireMarker() {
  const session = await requireCapability("attendance.mark");
  return {
    actorUserId: session.user.id,
    late: can(session.user.role as string | undefined, "attendance.markLate"),
  };
}

function isMarked(value: string): value is MarkedAttendance {
  return (
    value !== "unknown" &&
    (ATTENDANCE_VALUES as readonly string[]).includes(value)
  );
}

async function finish(
  result: AttendanceResult,
): Promise<AttendanceActionResult> {
  if (!result.ok) return { status: "error", message: result.error };
  if (result.changed > 0) {
    await applyRegistrationEffects([result.sessionId], { attendance: true });
  }
  return { status: "ok", changed: result.changed };
}

/** «Был» / «Не был»: кнопка обновляется на месте, без redirect. */
export async function markAttendanceAction(input: {
  registrationId: string;
  value: string;
}): Promise<AttendanceActionResult> {
  const marker = await requireMarker();
  if (!isMarked(input.value)) {
    return { status: "error", message: "Неизвестная отметка" };
  }
  return finish(
    await markAttendance({
      registrationId: input.registrationId,
      value: input.value,
      ...marker,
    }),
  );
}

export async function markRestNoShowAction(input: {
  sessionId: string;
}): Promise<AttendanceActionResult> {
  const marker = await requireMarker();
  return finish(
    await markRestNoShow({ sessionId: input.sessionId, ...marker }),
  );
}

export async function addWalkInAction(input: {
  sessionId: string;
  userId: string;
}): Promise<AttendanceActionResult> {
  const marker = await requireMarker();
  return finish(
    await addWalkIn({
      sessionId: input.sessionId,
      userId: input.userId,
      ...marker,
    }),
  );
}

/** Поиск участника для «Пришёл без записи». */
export async function searchUsersForWalkInAction(query: string, page: number) {
  await requireCapability("attendance.mark");
  const request: PageRequest = { page: Math.max(1, page), size: 10 };
  return searchUsersForAdminPaged(query, request);
}
