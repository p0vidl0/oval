import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginate,
  parsePageRequest,
} from "@/lib/admin/pagination";

describe("parsePageRequest", () => {
  it("defaults to first page of 10", () => {
    expect(parsePageRequest(undefined)).toEqual({ page: 1, size: 10 });
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });

  it("ignores garbage and clamps size", () => {
    expect(parsePageRequest("0", "-5")).toEqual({ page: 1, size: 10 });
    expect(parsePageRequest("abc", "2.5")).toEqual({ page: 1, size: 10 });
    expect(parsePageRequest("3", "25")).toEqual({ page: 3, size: 25 });
    expect(parsePageRequest("1", "100000").size).toBe(MAX_PAGE_SIZE);
  });
});

describe("paginate", () => {
  const data = Array.from({ length: 23 }, (_, i) => i + 1);
  const run = (page: number, size = 10) =>
    paginate(
      { page, size },
      async () => data.length,
      async (limit, offset) => data.slice(offset, offset + limit),
    );

  it("returns the requested slice and page count", async () => {
    expect(await run(2)).toEqual({
      items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      total: 23,
      page: 2,
      size: 10,
      pageCount: 3,
    });
  });

  it("clamps a page past the end to the last page", async () => {
    const result = await run(99);
    expect(result.page).toBe(3);
    expect(result.items).toEqual([21, 22, 23]);
  });

  it("empty list is a single empty page without fetching", async () => {
    let fetched = false;
    const result = await paginate(
      { page: 5, size: 10 },
      async () => 0,
      async () => {
        fetched = true;
        return [];
      },
    );
    expect(result).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
    expect(fetched).toBe(false);
  });
});
