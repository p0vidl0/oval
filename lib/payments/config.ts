export type PaymentProviderId = "mock" | string;

export function getPaymentProviderId(): PaymentProviderId {
  return process.env.PAYMENT_PROVIDER?.trim() || "mock";
}

export function getPaymentWebhookSecret(): string | undefined {
  const s = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  return s || undefined;
}
