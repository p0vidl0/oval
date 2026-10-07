import Link from "next/link";
import { DEFAULT_PAGE_SIZE } from "@/lib/admin/pagination";

type Props = {
  basePath: string;
  /** Текущие параметры URL — сохраняются в ссылках (фильтр, поиск, другие пагинаторы). */
  params: Record<string, string | undefined>;
  /** Имя параметра страницы; разные списки на одной странице — разные имена. */
  pageParam?: string;
  page: number;
  pageCount: number;
  total: number;
  size: number;
};

function href(
  basePath: string,
  params: Props["params"],
  pageParam: string,
  page: number,
) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && key !== pageParam) {
      qs.set(key, value);
    }
  }
  if (page > 1) qs.set(pageParam, String(page));
  const query = qs.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** «← Назад · 11–20 из 47 · Вперёд →». Не рисуется, если всё на одной странице. */
export function Pagination({
  basePath,
  params,
  pageParam = "page",
  page,
  pageCount,
  total,
  size,
}: Props) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  // Нестандартный размер страницы переносим в ссылки.
  const linkParams =
    size === DEFAULT_PAGE_SIZE ? params : { ...params, size: String(size) };

  return (
    <nav className="nl-pagination" aria-label="Страницы">
      {page > 1 ? (
        <Link
          className="nl-button nl-button--sm"
          href={href(basePath, linkParams, pageParam, page - 1)}
          rel="prev"
        >
          ← Назад
        </Link>
      ) : (
        <span className="nl-button nl-button--sm" aria-disabled="true">
          ← Назад
        </span>
      )}
      <span className="nl-pagination__info nl-mono data-sm">
        <span className="nl-show-desktop">
          {from}–{to} из {total} ·{" "}
        </span>
        стр. {page}/{pageCount}
      </span>
      {page < pageCount ? (
        <Link
          className="nl-button nl-button--sm"
          href={href(basePath, linkParams, pageParam, page + 1)}
          rel="next"
        >
          Вперёд →
        </Link>
      ) : (
        <span className="nl-button nl-button--sm" aria-disabled="true">
          Вперёд →
        </span>
      )}
    </nav>
  );
}
