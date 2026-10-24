import {
  type Attendance,
  attendanceLabel,
  canMarkAttendance,
  isAbsent,
  type MarkedAttendance,
} from "@/lib/domain/attendance/rules";
import type {
  CancelSource,
  PaymentState,
  RegistrationStatus,
} from "@/lib/domain/registration/types";
import type { TrainingSessionStatus } from "@/lib/training/status";

export type RegistrationViewer = "participant" | "staff";

export type RegistrationActions = {
  /** Участник: перейти к онлайн-оплате. */
  payOnline: boolean;
  /** Участник: оплата на месте, онлайн-оплата выключена. */
  payOnSite: boolean;
  /** Участник: отменить свою запись. Staff: снять участника. */
  cancel: boolean;
  /** Staff: «Оплачено на месте». */
  markPaid: boolean;
  /** Staff: возврат оплаты. */
  refund: boolean;
  /** Staff: перенос оплаты на другую тренировку. */
  transfer: boolean;
  /** Staff: отметить посещение (окно со сбора до 3 дней после). */
  markAttendance: boolean;
};

export type RegistrationView = {
  active: boolean;
  label: string;
  /** Отметка посещения активной записи; `null`, пока не отмечено. */
  attendance: { value: MarkedAttendance; label: string } | null;
  variant: "default" | "due" | "cancelled";
  actions: RegistrationActions;
};

export type DescribeRegistrationInput = {
  registration: {
    status: RegistrationStatus;
    paymentState: PaymentState;
    cancelledBy: CancelSource | null;
    transferredFromRegistrationId: string | null;
    attendance: Attendance;
  };
  session: {
    status: TrainingSessionStatus;
    priceCents: number;
    onlinePaymentEnabled: boolean;
    startsAt: Date;
    endsAt: Date | null;
    gatherAt: Date | null;
  };
  viewer: RegistrationViewer;
  now: Date;
  /** Возможности отмечающего: `attendance.markLate` — отметки после окна. */
  capabilities?: { attendanceLate?: boolean };
  /** Дата тренировки, на которую перенесли оплату (для подписи участнику). */
  transferTargetDate?: Date | null;
};

const NO_ACTIONS: RegistrationActions = {
  payOnline: false,
  payOnSite: false,
  cancel: false,
  markPaid: false,
  refund: false,
  transfer: false,
  markAttendance: false,
};

function formatDayMonth(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Omsk",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

function cancelledLabel(input: DescribeRegistrationInput): string {
  const { registration, viewer, transferTargetDate } = input;
  const participant = viewer === "participant";
  if (
    registration.cancelledBy === "transferred" ||
    registration.paymentState === "moved"
  ) {
    return participant && transferTargetDate
      ? `Оплата перенесена на ${formatDayMonth(transferTargetDate)}`
      : "Оплата перенесена";
  }
  if (registration.paymentState === "refunded") {
    return participant ? "Возврат оформлен" : "Возврат";
  }
  switch (registration.cancelledBy) {
    case "user":
      return participant ? "Отменена вами" : "Отменил участник";
    case "admin":
      return "Отменена клубом";
    case "session_cancelled":
      return "Тренировка отменена";
    default:
      return "Отменена";
  }
}

/** Участнику после отметки: «Был · оплачено», «Был · ждёт оплаты», «Пропустил». */
function participantAttendanceLabel(
  value: MarkedAttendance,
  paymentState: PaymentState,
): string {
  const attendance = attendanceLabel(value, "participant");
  if (paymentState === "paid") return `${attendance} · оплачено`;
  if (paymentState === "due" && value === "attended") {
    return `${attendance} · ждёт оплаты`;
  }
  return attendance;
}

function activeLabel(input: DescribeRegistrationInput): string {
  const { registration, session, viewer } = input;
  const participant = viewer === "participant";
  if (participant && registration.attendance !== "unknown") {
    return participantAttendanceLabel(
      registration.attendance,
      registration.paymentState,
    );
  }
  switch (registration.paymentState) {
    case "paid":
      return participant && registration.transferredFromRegistrationId
        ? "Оплата перенесена"
        : "Оплачено";
    case "free":
      return participant ? "Вы записаны" : "Записан";
    default:
      if (isAbsent(registration.attendance)) return "Без оплаты";
      return participant && !session.onlinePaymentEnabled
        ? "Оплата на месте"
        : "Ждёт оплаты";
  }
}

/**
 * Единая проекция записи для экранов и сервисов: подпись, цвет и доступные
 * действия. Сервис проверяет то же `actions`, что показывает кнопку.
 */
export function describeRegistration(
  input: DescribeRegistrationInput,
): RegistrationView {
  const { registration, session, viewer, now } = input;
  if (registration.status !== "active") {
    return {
      active: false,
      label: cancelledLabel(input),
      variant: "cancelled",
      attendance: null,
      actions: NO_ACTIONS,
    };
  }

  const due = registration.paymentState === "due";
  const paid = registration.paymentState === "paid";
  const beforeStart = now.getTime() < session.startsAt.getTime();
  const scheduled = session.status === "scheduled";

  const actions: RegistrationActions =
    viewer === "participant"
      ? {
          ...NO_ACTIONS,
          payOnline: due && scheduled && session.onlinePaymentEnabled,
          payOnSite: due && scheduled && !session.onlinePaymentEnabled,
          cancel: !paid && beforeStart,
        }
      : {
          ...NO_ACTIONS,
          cancel: !paid,
          markPaid: due,
          refund: paid,
          transfer: paid,
          markAttendance: canMarkAttendance({
            registration,
            session,
            now,
            late: input.capabilities?.attendanceLate,
          }).ok,
        };

  const marked = registration.attendance;
  return {
    active: true,
    label: activeLabel(input),
    variant: due && !isAbsent(marked) ? "due" : "default",
    attendance:
      marked === "unknown"
        ? null
        : { value: marked, label: attendanceLabel(marked, viewer) },
    actions,
  };
}
