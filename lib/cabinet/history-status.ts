import type {
  RegistrationCancelSource,
  RegistrationStatus,
} from "@/lib/training/status";

function formatTransferDate(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Omsk",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

export function historyStatus({
  registration,
  transferTargetDate,
}: {
  registration: {
    status: RegistrationStatus;
    cancelledBy: RegistrationCancelSource | null;
    transferredFromRegistrationId: string | null;
  };
  transferTargetDate?: Date;
}): { text: string; variant: "default" | "due" | "cancelled" } {
  if (registration.status === "transferred") {
    return {
      text: transferTargetDate
        ? `Оплата перенесена на ${formatTransferDate(transferTargetDate)}`
        : "Оплата перенесена",
      variant: "cancelled",
    };
  }
  if (registration.status === "refunded") {
    return { text: "Возврат оформлен", variant: "cancelled" };
  }
  if (registration.status === "cancelled") {
    const text =
      registration.cancelledBy === "user"
        ? "Отменена вами"
        : registration.cancelledBy === "admin"
          ? "Отменена клубом"
          : registration.cancelledBy === "session_cancelled"
            ? "Тренировка отменена"
            : "Отменена";
    return { text, variant: "cancelled" };
  }
  if (registration.transferredFromRegistrationId) {
    return { text: "Оплата перенесена", variant: "default" };
  }
  if (registration.status === "paid") {
    return { text: "Оплачено", variant: "default" };
  }
  if (registration.status === "pending_payment") {
    return { text: "Ждёт оплаты", variant: "due" };
  }
  return { text: registration.status, variant: "default" };
}
