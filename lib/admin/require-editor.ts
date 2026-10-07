import { canAccessAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export async function requireEditor() {
  const session = await getServerSession();
  if (!session || !canAccessAdmin(session.user.role as string | undefined)) {
    throw new Error("Forbidden");
  }
  return session;
}
