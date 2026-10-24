"use server";

import { requireCapability } from "@/lib/admin/require-capability";
import { applyRegistrationEffects } from "@/lib/app/effects";
import { markRegistrationPaid } from "@/lib/payments/mark-paid";

/** Dev/mock: ручное подтверждение оплаты. */
export async function adminConfirmPaymentForm(formData: FormData) {
  const session = await requireCapability("payments.confirmMock");

  const registrationId = String(formData.get("registration_id") ?? "");
  const result = await markRegistrationPaid({
    registrationId,
    source: "admin_mock",
    actorUserId: session.user.id,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }

  // SSE уже отправил confirmPaymentSucceeded.
  await applyRegistrationEffects([], { realtime: false });
}
