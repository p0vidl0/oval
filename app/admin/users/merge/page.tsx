import { redirect } from "next/navigation";
import { UserMergeForm } from "@/components/admin/user-merge-form";
import { ADMIN_HOME } from "@/lib/admin/routes";
import { can } from "@/lib/auth/capabilities";
import { getServerSession } from "@/lib/auth/session";

export default async function AdminUserMergePage() {
  const session = await getServerSession();
  if (
    !session ||
    !can(session.user.role as string | undefined, "users.merge")
  ) {
    redirect(ADMIN_HOME);
  }

  return (
    <main>
      <h1 className="nl-page-title nl-page-title--admin">
        Склейка пользователей
      </h1>
      <p className="caption" style={{ marginBottom: "var(--space-4)" }}>
        Источник помечается удалённым, данные переносятся в цель. Конфликт двух
        оплат за одну тренировку нужно снять вручную в разделе «Оплата».
      </p>
      <UserMergeForm />
    </main>
  );
}
