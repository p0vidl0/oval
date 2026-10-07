"use server";

import { revalidatePath } from "next/cache";
import { requireEditor } from "@/lib/admin/require-editor";
import { markRegistrationPaid } from "@/lib/payments/mark-paid";
import { publishSessionRegistrationsChanged } from "@/lib/realtime/publish-session-registrations-changed";
import { cancelUserRegistration } from "@/lib/training/registrations";
import {
  refundRegistration,
  transferRegistration,
} from "@/lib/training/session-service";

function revalidateRegistrations(...sessionIds: string[]) {
  revalidatePath("/admin/registrations");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/sessions");
  for (const id of sessionIds) {
    if (id) revalidatePath(`/admin/sessions/${id}`);
  }
  revalidatePath("/cabinet");
  revalidatePath("/feed");
}

export async function adminMarkPaidForm(formData: FormData) {
  const session = await requireEditor();
  const registrationId = String(formData.get("registration_id") ?? "");
  const sessionId = String(formData.get("session_id") ?? "");
  const result = await markRegistrationPaid({
    registrationId,
    source: "admin_onsite",
    actorUserId: session.user.id,
  });
  if (!result.ok) throw new Error(result.error);
  revalidateRegistrations(sessionId);
}

export async function adminRemoveRegistrationForm(formData: FormData) {
  const session = await requireEditor();
  const registrationId = String(formData.get("registration_id") ?? "");
  const result = await cancelUserRegistration(
    registrationId,
    session.user.id,
    true,
  );
  if (!result.ok) throw new Error(result.error);
  revalidateRegistrations(result.sessionId);
  await publishSessionRegistrationsChanged(result.sessionId);
}

export async function adminMarkRefundedForm(formData: FormData) {
  const session = await requireEditor();
  const registrationId = String(formData.get("registration_id") ?? "");
  const { sessionId } = await refundRegistration({
    registrationId,
    actorUserId: session.user.id,
  });
  revalidateRegistrations(sessionId);
  await publishSessionRegistrationsChanged(sessionId);
}

export async function adminTransferPaymentForm(formData: FormData) {
  await requireEditor();
  const registrationId = String(formData.get("from_registration_id") ?? "");
  const targetSessionId = String(formData.get("target_session_id") ?? "");
  const { fromSessionId } = await transferRegistration({
    registrationId,
    targetSessionId,
  });
  revalidateRegistrations(fromSessionId, targetSessionId);
  await publishSessionRegistrationsChanged(fromSessionId);
  await publishSessionRegistrationsChanged(targetSessionId);
}
