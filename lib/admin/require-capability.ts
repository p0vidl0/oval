import { type Capability, can } from "@/lib/auth/capabilities";
import { getServerSession } from "@/lib/auth/session";

export async function requireCapability(capability: Capability) {
  const session = await getServerSession();
  if (!session || !can(session.user.role as string | undefined, capability)) {
    throw new Error("Forbidden");
  }
  return session;
}
