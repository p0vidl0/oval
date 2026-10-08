import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NlShell } from "@/components/nl/shell";
import { canAccessAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login?next=/admin/sessions");
  if (!canAccessAdmin(session.user.role as string | undefined)) {
    redirect("/");
  }

  return (
    <NlShell tab="admin">
      <div className="nl-page">
        <nav className="nl-admin-nav" aria-label="Админка">
          <Link href="/admin/sessions">Тренировки</Link>
          <Link href="/admin/posts">Публикации</Link>
          <Link href="/admin/registrations">Участники</Link>
          <Link href="/admin/payments">Оплата</Link>
        </nav>
        {children}
      </div>
    </NlShell>
  );
}
