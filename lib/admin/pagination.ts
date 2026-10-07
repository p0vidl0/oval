/** Серверная пагинация списков админки (`?page=` и необязательный `?size=`). */

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export type PageRequest = { page: number; size: number };

export type Paged<T> = {
  items: T[];
  total: number;
  /** Номер страницы после приведения к допустимому диапазону (с 1). */
  page: number;
  size: number;
  pageCount: number;
};

function toPositiveInt(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

export function parsePageRequest(
  pageRaw: string | undefined,
  sizeRaw?: string | undefined,
): PageRequest {
  const size = Math.min(
    toPositiveInt(sizeRaw) ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  return { page: toPositiveInt(pageRaw) ?? 1, size };
}

/**
 * Считает количество, приводит номер страницы к диапазону (страница за
 * концом списка → последняя) и только потом запрашивает строки.
 */
export async function paginate<T>(
  request: PageRequest,
  count: () => Promise<number>,
  fetch: (limit: number, offset: number) => Promise<T[]>,
): Promise<Paged<T>> {
  const total = await count();
  const pageCount = Math.max(1, Math.ceil(total / request.size));
  const page = Math.min(request.page, pageCount);
  const items =
    total === 0 ? [] : await fetch(request.size, (page - 1) * request.size);
  return { items, total, page, size: request.size, pageCount };
}
