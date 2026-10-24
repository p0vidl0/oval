"use server";

import { redirect } from "next/navigation";
import { applyRegistrationEffects } from "@/lib/app/effects";
import { getServerSession } from "@/lib/auth/session";
import { safeInternalPath } from "@/lib/site/safe-internal-path";
import { cancelUserRegistration } from "@/lib/training/registrations";

export async function cancelRegistrationForm(formData: FormData) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  const registrationId = String(formData.get("registration_id") ?? "");
  const returnTo = safeInternalPath(
    String(formData.get("return_to") ?? "/cabinet"),
  );
  // Форма стоит на страницах участника: роль не снимает его правила.
  const result = await cancelUserRegistration(
    registrationId,
    session.user.id,
    "participant",
  );
  if (!result.ok) {
    const failed = new URL(returnTo, "https://internal.invalid");
    failed.searchParams.set("error", result.error);
    redirect(`${failed.pathname}${failed.search}`);
  }
  await applyRegistrationEffects([result.sessionId]);
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
    "participant",
  );
  if (!result.ok) return result;
  await applyRegistrationEffects([result.sessionId]);
  return { ok: true, sessionId: result.sessionId };
}
