"use server";

import { revalidatePath } from "next/cache";
import { canAccessAdmin, isAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { markRegistrationPaid } from "@/lib/payments/mark-paid";

async function requireEditor() {
  const session = await getServerSession();
  if (!session || !canAccessAdmin(session.user.role as string | undefined)) {
    throw new Error("Forbidden");
  }
  return session;
}

/** Dev/mock: только admin подтверждает оплату вручную. */
export async function adminConfirmPaymentForm(formData: FormData) {
  const session = await requireEditor();
  if (!isAdmin(session.user.role as string | undefined)) {
    throw new Error("Только admin может подтверждать mock-оплату");
  }

  const registrationId = String(formData.get("registration_id") ?? "");
  const result = await markRegistrationPaid({
    registrationId,
    source: "admin_mock",
    actorUserId: session.user.id,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }

  revalidatePath("/admin/registrations");
  revalidatePath("/admin/payments");
  revalidatePath("/cabinet");
  revalidatePath("/feed");
}
