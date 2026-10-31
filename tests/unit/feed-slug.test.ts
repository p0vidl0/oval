import { describe, expect, it } from "vitest";
import { postPath } from "@/lib/feed/open-post-url";
import {
  instantForNewPostSlug,
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

  it("uses session start for announcement slugs and publish time otherwise", () => {
    const sessionStartsAt = new Date("2026-10-31T14:00:00+06:00");
    const publishedAt = new Date("2026-10-30T12:00:00+06:00");
    expect(
      instantForNewPostSlug({
        type: "training_announcement",
        sessionStartsAt,
        publishedAt,
      }),
    ).toEqual(sessionStartsAt);
    expect(
      postSlugDay(
        instantForNewPostSlug({
          type: "news",
          publishedAt,
          sessionStartsAt,
        }),
      ),
    ).toBe("2026-10-30");
    expect(
      postSlugDay(
        instantForNewPostSlug({
          type: "training_rescheduled",
          publishedAt,
        }),
      ),
    ).toBe("2026-10-30");
  });

  it("builds canonical paths by post type", () => {
    expect(postPath("2026-10-31", "training_announcement")).toBe(
      "/sessions/2026-10-31",
    );
    expect(postPath("2026-10-30", "news")).toBe("/news/2026-10-30");
    expect(postPath("2026-10-30-2", "training_rescheduled")).toBe(
      "/news/2026-10-30-2",
    );
    expect(postPath("2026-10-30", "race")).toBe("/news/2026-10-30");
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
