import { redirect } from "next/navigation";
import { Pagination } from "@/components/admin/pagination";
import { UserMergeLoginDetails } from "@/components/admin/user-merge-login-details";
import { AdminUserRolePicker } from "@/components/admin/user-role-picker";
import { parsePageRequest } from "@/lib/admin/pagination";
import { ADMIN_HOME } from "@/lib/admin/routes";
import { searchUsersForAdminPaged } from "@/lib/admin/user-queries";
import { can } from "@/lib/auth/capabilities";
import { roleLabel } from "@/lib/auth/role-labels";
import { parseRole } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

type SearchParams = { q?: string; page?: string; size?: string };

const BASE_PATH = "/admin/users";

type Props = { searchParams: Promise<SearchParams> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const session = await getServerSession();
  if (
    !session ||
    !can(session.user.role as string | undefined, "users.manageRoles")
  ) {
    redirect(ADMIN_HOME);
  }

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const paged = await searchUsersForAdminPaged(
    q,
    parsePageRequest(params.page, params.size),
  );

  return (
    <main>
      <div className="nl-admin-head">
        <h1 className="nl-page-title nl-page-title--admin">Пользователи</h1>
      </div>

      <p className="caption" style={{ marginBottom: "var(--space-4)" }}>
        Роли участник, редактор и админ. Супер-админа здесь не меняют.
      </p>

      <form action={BASE_PATH} className="nl-admin-search">
        <input
          name="q"
          type="search"
          className="nl-input"
          placeholder="Имя, email или id"
          defaultValue={q}
          aria-label="Поиск пользователя"
        />
        <button type="submit" className="nl-button">
          Найти
        </button>
      </form>

      <section className="nl-admin-section">
        <h2 className="nl-label">{q ? "Найдено" : "Все пользователи"}</h2>
        {paged.total === 0 ? (
          <p className="caption">
            {q ? "Никого не нашли." : "Пользователей пока нет."}
          </p>
        ) : (
          <div className="nl-table-wrap">
            <table className="nl-table nl-table--valign-middle">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Вход</th>
                  <th>Роль</th>
                  <th>Назначение</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((u) => {
                  const parsed = parseRole(u.role);
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.name?.trim() || (
                          <span className="nl-muted">без имени</span>
                        )}
                      </td>
                      <td>
                        <UserMergeLoginDetails
                          user={u}
                          className="caption nl-mono"
                        />
                      </td>
                      <td className="caption">{roleLabel(parsed)}</td>
                      <td>
                        <AdminUserRolePicker
                          userId={u.id}
                          currentRole={u.role}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          basePath={BASE_PATH}
          params={{ q: q || undefined }}
          page={paged.page}
          pageCount={paged.pageCount}
          total={paged.total}
          size={paged.size}
        />
      </section>
    </main>
  );
}
