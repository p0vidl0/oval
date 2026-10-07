import { describe, expect, it } from "vitest";
import {
  initialPublicationState,
  nextPublicationState,
  PublicationError,
} from "@/lib/admin/publication-form";
import { isPostLive, isPostScheduled } from "@/lib/feed/publication";

const now = new Date("2026-06-01T12:00:00Z");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// 2026-06-02 10:00 Asia/Omsk (UTC+6) = 04:00 UTC
const scheduleFields = {
  submit_action: "schedule",
  publish_date: "2026-06-02",
  publish_time: "10:00",
};
const at = new Date("2026-06-02T04:00:00Z");

describe("initialPublicationState", () => {
  it("publish now / draft / schedule", () => {
    expect(
      initialPublicationState(form({ submit_action: "publish" }), now),
    ).toMatchObject({ status: "published", publishedAt: now });
    expect(
      initialPublicationState(form({ submit_action: "draft" }), now).status,
    ).toBe("draft");
    expect(initialPublicationState(form(scheduleFields), now)).toMatchObject({
      status: "published",
      publishedAt: at,
    });
  });

  it("rejects past or empty schedule time", () => {
    expect(() =>
      initialPublicationState(
        form({ ...scheduleFields, publish_date: "2026-05-01" }),
        now,
      ),
    ).toThrow(PublicationError);
    expect(() =>
      initialPublicationState(
        form({ submit_action: "schedule", publish_date: "" }),
        now,
      ),
    ).toThrow("Укажите дату и время публикации");
  });
});

describe("nextPublicationState", () => {
  const draft = {
    status: "draft" as const,
    publishedAt: null,
    unpublishedAt: null,
  };
  const scheduled = {
    status: "published" as const,
    publishedAt: at,
    unpublishedAt: null,
  };
  const live = {
    status: "published" as const,
    publishedAt: new Date("2026-05-20T00:00:00Z"),
    unpublishedAt: null,
  };

  it("schedules a draft", () => {
    const next = nextPublicationState(form(scheduleFields), draft, now);
    expect(isPostScheduled(next, now)).toBe(true);
    expect(isPostLive(next, now)).toBe(false);
  });

  it("publish now moves scheduled time to now", () => {
    const next = nextPublicationState(
      form({ submit_action: "publish" }),
      scheduled,
      now,
    );
    expect(next.publishedAt).toEqual(now);
  });

  it("draft cancels a scheduled publication", () => {
    expect(
      nextPublicationState(form({ submit_action: "draft" }), scheduled, now),
    ).toMatchObject({ status: "draft", publishedAt: null });
  });

  it("cannot schedule a live post", () => {
    expect(() => nextPublicationState(form(scheduleFields), live, now)).toThrow(
      PublicationError,
    );
  });

  it("save keeps the schedule", () => {
    expect(
      nextPublicationState(form({ submit_action: "save" }), scheduled, now),
    ).toEqual(scheduled);
  });

  it("republish keeps original date for unpublished post", () => {
    const unpublished = {
      ...live,
      status: "unpublished" as const,
      unpublishedAt: now,
    };
    expect(
      nextPublicationState(form({ submit_action: "publish" }), unpublished, now)
        .publishedAt,
    ).toEqual(live.publishedAt);
  });
});
