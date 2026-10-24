/** Правила посещения: чистые функции, без БД. */

export const ATTENDANCE_VALUES = [
  "unknown",
  "attended",
  "no_show",
  "excused",
] as const;
export type Attendance = (typeof ATTENDANCE_VALUES)[number];
export type MarkedAttendance = Exclude<Attendance, "unknown">;

/** Сколько дней после тренировки отметки ставит и правит admin; дальше — только `attendance.markLate`. */
export const ATTENDANCE_GRACE_DAYS = 3;

/** Тренировка без `ends_at` считается идущей 2 часа (как на «Сегодня»). */
const DEFAULT_DURATION_MS = 2 * 3600_000;
/** Без `gather_at` отмечать можно за час до старта. */
const OPEN_BEFORE_START_MS = 3600_000;
const DAY_MS = 24 * 3600_000;

type WindowSession = {
  startsAt: Date;
  endsAt: Date | null;
  gatherAt: Date | null;
};

export function sessionEnd(session: WindowSession): Date {
  return (
    session.endsAt ?? new Date(session.startsAt.getTime() + DEFAULT_DURATION_MS)
  );
}

/** Окно отметки: со сбора и до `ATTENDANCE_GRACE_DAYS` дней после конца. */
export function attendanceWindow(session: WindowSession): {
  opensAt: Date;
  closesAt: Date;
} {
  const opensAt =
    session.gatherAt ??
    new Date(session.startsAt.getTime() - OPEN_BEFORE_START_MS);
  return {
    opensAt,
    closesAt: new Date(
      sessionEnd(session).getTime() + ATTENDANCE_GRACE_DAYS * DAY_MS,
    ),
  };
}

/**
 * Когда меняется набор действий тренера: открытие окна (кнопки «Был / Не
 * был»), старт («Остальные не пришли»), конец (тренировка уходит с «Сегодня»),
 * закрытие окна.
 */
export function attendanceMoments(session: WindowSession): Date[] {
  const { opensAt, closesAt } = attendanceWindow(session);
  return [opensAt, session.startsAt, sessionEnd(session), closesAt];
}

export type AttendanceGate =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "closed_registration"
        | "session_cancelled"
        | "not_open"
        | "too_late";
    };

export const ATTENDANCE_BLOCK_MESSAGES: Record<
  Exclude<AttendanceGate, { ok: true }>["reason"],
  string
> = {
  closed_registration: "Запись закрыта — отметка не нужна",
  session_cancelled: "Тренировка отменена",
  not_open: "Отмечать можно со сбора",
  too_late: `Отметки закрыты: прошло больше ${ATTENDANCE_GRACE_DAYS} дней`,
};

/** `late` — у отмечающего есть `attendance.markLate`. */
export function canMarkAttendance(params: {
  registration: { status: "active" | "cancelled" };
  session: WindowSession & { status: "scheduled" | "cancelled" };
  now: Date;
  late?: boolean;
}): AttendanceGate {
  if (params.registration.status !== "active") {
    return { ok: false, reason: "closed_registration" };
  }
  if (params.session.status !== "scheduled") {
    return { ok: false, reason: "session_cancelled" };
  }
  const { opensAt, closesAt } = attendanceWindow(params.session);
  if (params.now < opensAt) return { ok: false, reason: "not_open" };
  if (params.now > closesAt && !params.late) {
    return { ok: false, reason: "too_late" };
  }
  return { ok: true };
}

const LABELS: Record<MarkedAttendance, { participant: string; staff: string }> =
  {
    attended: { participant: "Был", staff: "Был" },
    no_show: { participant: "Пропустил", staff: "Не пришёл" },
    excused: { participant: "Уважительная причина", staff: "Уважительная" },
  };

/**
 * Не пришёл (или уважительная) и не оплатил — не долг: денег не ждём, в
 * «ждут оплаты» не считаем, «Оплачено» уходит в меню «…».
 */
export function isAbsent(attendance: Attendance): boolean {
  return attendance === "no_show" || attendance === "excused";
}

export function attendanceLabel(
  value: MarkedAttendance,
  viewer: "participant" | "staff",
): string {
  return LABELS[value][viewer];
}
