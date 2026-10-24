import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { NlShell } from "@/components/nl/shell";
import { ADMIN_HOME, buildAdminMenu } from "@/lib/admin/routes";
import { can } from "@/lib/auth/capabilities";
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
  if (!session) redirect(`/login?next=${ADMIN_HOME}`);
  const role = session.user.role as string | undefined;
  if (!can(role, "admin.access")) {
    redirect("/");
  }

  const groups = buildAdminMenu(role);

  return (
    <NlShell tab="admin">
      <div className="nl-page">
        <AdminNav groups={groups} />
        {children}
      </div>
    </NlShell>
  );
}
