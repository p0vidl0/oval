import { describe, expect, it } from "vitest";
import {
  feedPostIdFromAnalyticsPath,
  feedPostSlugFromAnalyticsPath,
  labelForAnalyticsPath,
  STATIC_ANALYTICS_PATH_LABELS,
} from "@/lib/analytics/path-labels";

const POST_ID = "a14b103d-ac81-4e48-a696-d3147d6ed7da";

describe("feedPostIdFromAnalyticsPath", () => {
  it("extracts uuid from feed post path", () => {
    expect(feedPostIdFromAnalyticsPath(`/feed/${POST_ID}`)).toBe(POST_ID);
  });

  it("returns null for feed index and invalid ids", () => {
    expect(feedPostIdFromAnalyticsPath("/feed")).toBeNull();
    expect(feedPostIdFromAnalyticsPath("/feed/not-a-uuid")).toBeNull();
    expect(feedPostIdFromAnalyticsPath("/login")).toBeNull();
  });
});

describe("feedPostSlugFromAnalyticsPath", () => {
  it("reads root and legacy slug paths", () => {
    expect(feedPostSlugFromAnalyticsPath("/2026-10-31")).toBe("2026-10-31");
    expect(feedPostSlugFromAnalyticsPath("/2026-10-31-2")).toBe("2026-10-31-2");
    expect(feedPostSlugFromAnalyticsPath("/feed/2026-10-31")).toBe(
      "2026-10-31",
    );
  });
});

describe("labelForAnalyticsPath", () => {
  it("uses static labels for known routes", () => {
    expect(labelForAnalyticsPath("/", new Map())).toBe("Лента");
    expect(labelForAnalyticsPath("/feed", new Map())).toBe("Лента");
    expect(labelForAnalyticsPath("/login", new Map())).toBe("Вход");
    expect(labelForAnalyticsPath("/privacy", new Map())).toBe(
      STATIC_ANALYTICS_PATH_LABELS["/privacy"],
    );
  });

  it("uses post title when present", () => {
    const titles = new Map([[POST_ID, "Субботняя тренировка"]]);
    expect(labelForAnalyticsPath(`/feed/${POST_ID}`, titles)).toBe(
      "Субботняя тренировка",
    );
  });

  it("falls back to path when post title missing", () => {
    const path = `/feed/${POST_ID}`;
    expect(labelForAnalyticsPath(path, new Map())).toBe(path);
  });

  it("uses slug map keys for root post paths", () => {
    const titles = new Map([["slug:2026-10-31", "Новость дня"]]);
    expect(labelForAnalyticsPath("/2026-10-31", titles)).toBe("Новость дня");
  });

  it("falls back to path for unknown routes", () => {
    expect(labelForAnalyticsPath("/some/unknown", new Map())).toBe(
      "/some/unknown",
    );
  });
});
