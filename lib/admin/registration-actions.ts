"use server";

import { requireCapability } from "@/lib/admin/require-capability";
import { applyRegistrationEffects } from "@/lib/app/effects";
import { markRegistrationPaid } from "@/lib/payments/mark-paid";
import { cancelUserRegistration } from "@/lib/training/registrations";
import {
  refundRegistration,
  transferRegistration,
} from "@/lib/training/session-service";

export async function adminMarkPaidForm(formData: FormData) {
  const session = await requireCapability("registrations.manage");
  const registrationId = String(formData.get("registration_id") ?? "");
  const sessionId = String(formData.get("session_id") ?? "");
  const rawMethod = String(formData.get("method") ?? "");
  if (rawMethod !== "cash" && rawMethod !== "bank_transfer") {
    throw new Error("Выберите способ оплаты");
  }
  const result = await markRegistrationPaid({
    registrationId,
    source: "admin_onsite",
    actorUserId: session.user.id,
    method: rawMethod,
  });
  if (!result.ok) throw new Error(result.error);
  // SSE уже отправил confirmPaymentSucceeded.
  await applyRegistrationEffects([sessionId], { realtime: false });
}

export async function adminRemoveRegistrationForm(formData: FormData) {
  const session = await requireCapability("registrations.manage");
  const registrationId = String(formData.get("registration_id") ?? "");
  const result = await cancelUserRegistration(
    registrationId,
    session.user.id,
    "staff",
  );
  if (!result.ok) throw new Error(result.error);
  await applyRegistrationEffects([result.sessionId]);
}

export async function adminMarkRefundedForm(formData: FormData) {
  const session = await requireCapability("payments.refund");
  const registrationId = String(formData.get("registration_id") ?? "");
  const { sessionId } = await refundRegistration({
    registrationId,
    actorUserId: session.user.id,
  });
  await applyRegistrationEffects([sessionId]);
}

export async function adminTransferPaymentForm(formData: FormData) {
  const session = await requireCapability("payments.refund");
  const registrationId = String(formData.get("from_registration_id") ?? "");
  const targetSessionId = String(formData.get("target_session_id") ?? "");
  const { fromSessionId } = await transferRegistration({
    registrationId,
    targetSessionId,
    actorUserId: session.user.id,
  });
  await applyRegistrationEffects([fromSessionId, targetSessionId]);
}
