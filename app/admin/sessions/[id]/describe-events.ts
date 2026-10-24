import type { RegistrationEventKind } from "@/lib/domain/registration/events";
import { formatDateTimeRu } from "@/lib/format/datetime";

const CHANGE_LABELS: Record<string, string> = {
  title: "название",
  priceCents: "цена",
  capacity: "лимит мест",
  registrationEnabled: "приём записи",
  onlinePaymentEnabled: "онлайн-оплата",
  startsAt: "начало",
  endsAt: "окончание",
  gatherAt: "сбор",
};

export function describeSessionEvent(
  kind: string,
  payload: Record<string, unknown>,
): string {
  switch (kind) {
    case "created":
      return "Тренировка создана";
    case "updated": {
      const changes = Object.keys(
        (payload.changes as Record<string, unknown> | undefined) ?? {},
      ).map((k) => CHANGE_LABELS[k] ?? k);
      return changes.length
        ? `Изменены параметры: ${changes.join(", ")}`
        : "Изменены параметры";
    }
    case "rescheduled": {
      const from = payload.previousStartsAt as string | undefined;
      const to = payload.newStartsAt as string | undefined;
      return from && to
        ? `Перенос: ${formatDateTimeRu(from)} → ${formatDateTimeRu(to)}`
        : "Перенос";
    }
    case "cancelled": {
      const reason = payload.reason as string | null | undefined;
      return reason ? `Отмена: ${reason}` : "Отмена";
    }
    default:
      return kind;
  }
}

const PAYMENT_SOURCE_LABELS: Record<string, string> = {
  webhook: "Оплата онлайн",
  admin_onsite: "Оплачено на месте",
  admin_mock: "Оплата подтверждена вручную",
};

export function describeRegistrationEvent(
  kind: RegistrationEventKind,
  payload: Record<string, unknown>,
): string {
  switch (kind) {
    case "created":
      return payload.source === "coach" ? "Добавлен тренером" : "Записался";
    case "attendance_marked": {
      const to = String(payload.to);
      const label =
        to === "attended"
          ? "был"
          : to === "no_show"
            ? "не пришёл"
            : to === "excused"
              ? "уважительная"
              : to;
      return payload.from && payload.from !== "unknown"
        ? `Отметка исправлена: ${label}`
        : `Отмечен: ${label}`;
    }
    case "cancelled":
      return payload.cancelledBy === "user" ? "Отменил запись" : "Снят клубом";
    case "payment_succeeded":
      if (payload.source === "admin_onsite") {
        if (payload.method === "bank_transfer") return "Оплачено переводом";
        if (payload.method === "cash") return "Оплачено наличными";
      }
      return (
        PAYMENT_SOURCE_LABELS[String(payload.source)] ?? "Оплата подтверждена"
      );
    case "refunded":
      return "Возврат оплаты";
    case "transferred_out":
      return "Оплата перенесена на другую тренировку";
    case "transferred_in":
      return "Оплата перенесена с другой тренировки";
    case "released":
      return "Снят при отмене тренировки";
    case "merged":
      return payload.cancelled
        ? "Склейка аккаунтов, дубль записи снят"
        : "Склейка аккаунтов";
    default:
      return kind;
  }
}
