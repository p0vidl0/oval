import { redirect } from "next/navigation";
import { UserMergeForm } from "@/components/admin/user-merge-form";
import { isSuperAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export default async function AdminUserMergePage() {
  const session = await getServerSession();
  if (!session || !isSuperAdmin(session.user.role as string | undefined)) {
    redirect("/admin/sessions");
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
