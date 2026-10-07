"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { publishSessionRegistrationsChanged } from "@/lib/realtime/publish-session-registrations-changed";
import { cancelUserRegistration } from "@/lib/training/registrations";

export async function cancelRegistrationForm(formData: FormData) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  const registrationId = String(formData.get("registration_id") ?? "");
  const returnTo = String(formData.get("return_to") ?? "/cabinet");
  const isAdmin = canAccessAdmin(session.user.role as string | undefined);
  const result = await cancelUserRegistration(
    registrationId,
    session.user.id,
    isAdmin,
  );
  if (!result.ok) {
    redirect(`${returnTo}?error=${encodeURIComponent(result.error)}`);
  }
  await publishSessionRegistrationsChanged(result.sessionId);
  revalidatePath("/cabinet");
  revalidatePath("/feed");
  redirect(returnTo);
}

export type CancelRegistrationResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

/** Отмена из карточки ленты: без редиректа, карточка обновляется на клиенте. */
export async function cancelRegistrationClient(
  registrationId: string,
): Promise<CancelRegistrationResult> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: "Войдите, чтобы отменить запись" };
  // Из ленты отменяют как участник — даже админ подчиняется правилам участника.
  const result = await cancelUserRegistration(
    registrationId,
    session.user.id,
    false,
  );
  if (!result.ok) return result;
  await publishSessionRegistrationsChanged(result.sessionId);
  revalidatePath("/cabinet");
  revalidatePath("/feed");
  return { ok: true, sessionId: result.sessionId };
}
