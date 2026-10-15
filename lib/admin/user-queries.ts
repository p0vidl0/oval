import {
  and,
  asc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import {
  DEFAULT_PAGE_SIZE,
  type PageRequest,
  paginate,
} from "@/lib/admin/pagination";
import { db } from "@/lib/db/client";
import { countRows } from "@/lib/db/count-rows";
import { account, user } from "@/lib/db/schema/auth-schema";

export type AdminUserAccountRow = {
  providerId: string;
  accountId: string;
};

export type AdminUserListRow = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  accounts: AdminUserAccountRow[];
};

type AdminUserListRowBase = Omit<AdminUserListRow, "accounts">;

async function attachAccountsToUsers(
  rows: AdminUserListRowBase[],
): Promise<AdminUserListRow[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const accountRows = await db
    .select({
      userId: account.userId,
      providerId: account.providerId,
      accountId: account.accountId,
    })
    .from(account)
    .where(inArray(account.userId, ids))
    .orderBy(asc(account.providerId), asc(account.accountId));

  const byUserId = new Map<string, AdminUserAccountRow[]>();
  for (const row of accountRows) {
    const list = byUserId.get(row.userId) ?? [];
    list.push({ providerId: row.providerId, accountId: row.accountId });
    byUserId.set(row.userId, list);
  }

  return rows.map((row) => ({
    ...row,
    accounts: byUserId.get(row.id) ?? [],
  }));
}

function escapeIlikePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, "\\$&")}%`;
}

/** В склейке только пользователи с email или хотя бы одним account. */
function mergeEligibleUserWhere(): SQL {
  return and(
    isNull(user.deletedAt),
    or(
      sql`trim(coalesce(${user.email}, '')) <> ''`,
      exists(
        db
          .select({ id: account.id })
          .from(account)
          .where(eq(account.userId, user.id)),
      ),
    ),
  ) as SQL;
}

function activeUserSearchWhere(query: string): SQL | undefined {
  const q = query.trim();
  const eligible = mergeEligibleUserWhere();
  if (!q) return eligible;
  const pattern = escapeIlikePattern(q);
  return and(
    eligible,
    or(ilike(user.name, pattern), ilike(user.email, pattern), eq(user.id, q)),
  );
}

/** Поиск пользователей для админки (10 на страницу по умолчанию). */
export async function searchUsersForAdminPaged(
  query: string,
  request: PageRequest = { page: 1, size: DEFAULT_PAGE_SIZE },
) {
  const where = activeUserSearchWhere(query);
  const paged = await paginate(
    request,
    () => countRows(user, where),
    (limit, offset) =>
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        })
        .from(user)
        .where(where)
        .orderBy(asc(user.name), asc(user.id))
        .limit(limit)
        .offset(offset),
  );
  return {
    ...paged,
    items: await attachAccountsToUsers(paged.items),
  };
}

export async function getUserSummary(userId: string) {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      deletedAt: user.deletedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row ?? null;
}
