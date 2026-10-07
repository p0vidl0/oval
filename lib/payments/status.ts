/** Статус платежа для участника. */
export function paymentStatusLabel(payment: {
  status: "pending" | "succeeded" | "failed" | "cancelled";
  metadata?: Record<string, unknown> | null;
}): string {
  switch (payment.status) {
    case "pending":
      return "Ожидает оплаты";
    case "succeeded":
      return "Оплачен";
    case "failed":
      return "Не прошёл";
    case "cancelled":
      return payment.metadata?.refundedAt ? "Возврат" : "Отменён";
  }
}
