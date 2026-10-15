import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isUserDeleted } from "@/lib/auth/user-active";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema/auth-schema";

export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return null;

  const [row] = await db
    .select({ deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (isUserDeleted(row)) {
    return null;
  }

  return session;
}
