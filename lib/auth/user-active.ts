import { isNull } from "drizzle-orm";
import { user } from "@/lib/db/schema/auth-schema";

type UserRow = typeof user.$inferSelect;

export function isUserDeleted(
  row: Pick<UserRow, "deletedAt"> | null | undefined,
): boolean {
  return Boolean(row?.deletedAt);
}

export function activeUserCondition() {
  return isNull(user.deletedAt);
}
