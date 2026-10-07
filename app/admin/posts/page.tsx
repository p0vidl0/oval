import Link from "next/link";
import { PostStatusBadge } from "@/components/admin/admin-badges";
import { ClickableRow } from "@/components/admin/clickable-row";
import { Pagination } from "@/components/admin/pagination";
import { FilterNav } from "@/components/nl/filter-nav";
import { parsePageRequest } from "@/lib/admin/pagination";
import {
  type AdminPostFilter,
  getSessionsByIds,
  listAllFeedPostsForAdmin,
} from "@/lib/feed/queries";
import { FEED_POST_TYPE_LABELS } from "@/lib/feed/types";
import {
  formatDateTimeRu,
  formatShortListDate,
  formatTimeHm,
} from "@/lib/format/datetime";

type Props = {
  searchParams: Promise<{ status?: string; page?: string; size?: string }>;
};

const STATUS_FILTERS: { key: AdminPostFilter | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "draft", label: "Черновики" },
  { key: "scheduled", label: "Запланированные" },
  { key: "published", label: "Опубликованные" },
  { key: "unpublished", label: "Снятые" },
];

function postsFilterHref(key: AdminPostFilter | "all") {
  return key === "all" ? "/admin/posts" : `/admin/posts?status=${key}`;
}

function parseFilter(raw: string | undefined): AdminPostFilter | undefined {
  return raw === "draft" ||
    raw === "scheduled" ||
    raw === "published" ||
    raw === "unpublished"
    ? raw
    : undefined;
}

export default async function AdminPostsPage({ searchParams }: Props) {
  const params = await searchParams;
  const filter = parseFilter(params.status);
  const result = await listAllFeedPostsForAdmin({
    filter,
    request: parsePageRequest(params.page, params.size),
  });
  const posts = result.items;
  const sessions = await getSessionsByIds(
    posts.flatMap((p) => (p.relatedSessionId ? [p.relatedSessionId] : [])),
  );
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const now = new Date();

  return (
    <main>
      <div className="nl-admin-head">
        <h1 className="nl-page-title nl-page-title--admin">Публикации</h1>
        <Link href="/admin/posts/new" className="nl-button nl-button--primary">
          Добавить новость
        </Link>
      </div>

      <FilterNav
        label="Статус"
        value={postsFilterHref(filter ?? "all")}
        options={STATUS_FILTERS.map((f) => ({
          href: postsFilterHref(f.key),
          label: f.label,
        }))}
      />

      <div className="nl-table-wrap">
        <table className="nl-table">
          <thead>
            <tr>
              <th>Тип</th>
              <th>Публикация</th>
              <th>Статус</th>
              <th>Тренировка</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={4}>Нет публикаций</td>
              </tr>
            ) : (
              posts.map((post) => {
                const tr = post.relatedSessionId
                  ? sessionById.get(post.relatedSessionId)
                  : undefined;
                return (
                  <ClickableRow key={post.id} href={`/admin/posts/${post.id}`}>
                    <td>{FEED_POST_TYPE_LABELS[post.type]}</td>
                    <td>
                      <Link href={`/admin/posts/${post.id}`}>
                        <strong>{post.title}</strong>
                      </Link>
                      {post.pinned ? (
                        <span
                          className="nl-mono data-sm"
                          style={{ color: "var(--ink-muted)" }}
                        >
                          {" "}
                          · закреплено
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <PostStatusBadge
                        status={post.status}
                        publishedAt={post.publishedAt}
                        now={now}
                      />
                      <br />
                      <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                        {formatDateTimeRu(
                          post.unpublishedAt ??
                            post.publishedAt ??
                            post.updatedAt,
                        )}
                      </span>
                    </td>
                    <td>
                      {tr ? (
                        <Link
                          href={`/admin/sessions/${tr.id}`}
                          className="nl-mono data-sm"
                        >
                          {formatShortListDate(tr.startsAt)}
                          <span className="nl-show-desktop"> ·</span>{" "}
                          {formatTimeHm(tr.startsAt)}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--ink-muted)" }}>—</span>
                      )}
                    </td>
                  </ClickableRow>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        basePath="/admin/posts"
        params={{ status: filter }}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        size={result.size}
      />
    </main>
  );
}
