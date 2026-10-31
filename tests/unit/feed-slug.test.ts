import { describe, expect, it } from "vitest";
import {
  instantForPostSlug,
  isLikelyPostSlug,
  postSlugDay,
  slugForOrdinal,
} from "@/lib/feed/slug";

describe("post slug format", () => {
  it("accepts date and optional suffix", () => {
    expect(isLikelyPostSlug("2026-10-31")).toBe(true);
    expect(isLikelyPostSlug("2026-10-31-2")).toBe(true);
    expect(isLikelyPostSlug("preview")).toBe(false);
    expect(isLikelyPostSlug("feed")).toBe(false);
  });

  it("builds ordinal slugs", () => {
    expect(slugForOrdinal("2026-10-31", 1)).toBe("2026-10-31");
    expect(slugForOrdinal("2026-10-31", 3)).toBe("2026-10-31-3");
  });

  it("uses Asia/Omsk calendar day", () => {
    // 2026-10-30 22:00 UTC = 2026-10-31 04:00 Omsk
    const day = postSlugDay(new Date("2026-10-30T22:00:00.000Z"));
    expect(day).toBe("2026-10-31");
  });

  it("prefers published_at over created_at for slug day", () => {
    const publishedAt = new Date("2099-01-02T12:00:00+06:00");
    const createdAt = new Date("2099-01-01T12:00:00+06:00");
    expect(instantForPostSlug({ publishedAt, createdAt })).toEqual(publishedAt);
    expect(instantForPostSlug({ publishedAt: null, createdAt })).toEqual(
      createdAt,
    );
  });
});
