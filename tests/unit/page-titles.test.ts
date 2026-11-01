import type { Metadata } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as postImages from "@/lib/feed/post-images";
import { metadataForPublicPost } from "@/lib/feed/public-dated-post";
import * as feedQueries from "@/lib/feed/queries";
import type { FeedPostType } from "@/lib/feed/types";
import { pageDocumentTitle, siteDocumentTitle } from "@/lib/site/public-origin";
import * as adminQueries from "@/lib/training/admin-queries";

/** `rows[0] ?? null` в запросах сужается до строки, хотя в рантайме бывает null. */
function nullable<T>(value: T | null): T {
  return value as T;
}

function absoluteTitle(metadata: Metadata): string {
  const { title } = metadata;
  if (
    title &&
    typeof title === "object" &&
    "absolute" in title &&
    typeof title.absolute === "string"
  ) {
    return title.absolute;
  }
  throw new Error(`expected absolute title, got ${JSON.stringify(title)}`);
}

function fakePost(title: string, type: FeedPostType) {
  return {
    id: "post-1",
    title,
    body: "Текст анонса",
    type,
    slug: "2026-10-31",
    publishedAt: new Date("2026-10-31T12:00:00Z"),
    createdAt: new Date("2026-10-31T12:00:00Z"),
  } as NonNullable<
    Awaited<ReturnType<typeof feedQueries.getPublishedFeedPostBySlug>>
  >;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("static page titles", () => {
  const pages: Array<[string, () => Promise<Metadata>, string]> = [
    [
      "home",
      async () => (await import("@/app/feed/feed-page")).feedPageMetadata,
      siteDocumentTitle,
    ],
    [
      "privacy",
      async () => (await import("@/app/privacy/page")).metadata,
      pageDocumentTitle("Политика конфиденциальности"),
    ],
    [
      "updates",
      async () => (await import("@/app/updates/page")).metadata,
      pageDocumentTitle("Обновления"),
    ],
    [
      "login",
      async () => (await import("@/app/login/page")).metadata,
      pageDocumentTitle("Вход"),
    ],
    [
      "telegram login",
      async () =>
        (await import("@/app/login/telegram/complete/layout")).metadata,
      pageDocumentTitle("Вход через Telegram"),
    ],
    [
      "cabinet",
      async () => (await import("@/app/cabinet/page")).metadata,
      pageDocumentTitle("Личный кабинет"),
    ],
    [
      "checkout",
      async () =>
        (await import("@/app/cabinet/pay/[registrationId]/page")).metadata,
      pageDocumentTitle("Оплата тренировки"),
    ],
    [
      "receipt",
      async () => (await import("@/app/cabinet/payments/[id]/page")).metadata,
      pageDocumentTitle("Квитанция"),
    ],
    [
      "admin today",
      async () => (await import("@/app/admin/page")).metadata,
      pageDocumentTitle("Сегодня"),
    ],
    [
      "admin schedule",
      async () => (await import("@/app/admin/sessions/page")).metadata,
      pageDocumentTitle("Расписание"),
    ],
    [
      "new training",
      async () => (await import("@/app/admin/sessions/new/page")).metadata,
      pageDocumentTitle("Новая тренировка"),
    ],
    [
      "admin posts",
      async () => (await import("@/app/admin/posts/page")).metadata,
      pageDocumentTitle("Публикации"),
    ],
    [
      "admin payments",
      async () => (await import("@/app/admin/payments/page")).metadata,
      pageDocumentTitle("Оплата"),
    ],
    [
      "admin users",
      async () => (await import("@/app/admin/users/page")).metadata,
      pageDocumentTitle("Пользователи"),
    ],
    [
      "user merge",
      async () => (await import("@/app/admin/users/merge/page")).metadata,
      pageDocumentTitle("Склейка пользователей"),
    ],
    [
      "analytics",
      async () => (await import("@/app/admin/analytics/page")).metadata,
      pageDocumentTitle("Статистика"),
    ],
  ];

  it.each(pages)("%s", async (_name, load, expected) => {
    expect(absoluteTitle(await load())).toBe(expected);
  });
});

describe("dynamic page titles", () => {
  it("names a new post or a training announcement", async () => {
    const { generateMetadata } = await import("@/app/admin/posts/new/page");
    const news = await generateMetadata({
      searchParams: Promise.resolve({}),
    });
    const announcement = await generateMetadata({
      searchParams: Promise.resolve({ session: "session-1" }),
    });
    expect(absoluteTitle(news)).toBe(pageDocumentTitle("Новая новость"));
    expect(absoluteTitle(announcement)).toBe(
      pageDocumentTitle("Анонс тренировки"),
    );
  });

  it("uses the training title", async () => {
    vi.spyOn(adminQueries, "getAdminSession").mockResolvedValue({
      session: { title: "  вечерняя" },
    } as NonNullable<Awaited<ReturnType<typeof adminQueries.getAdminSession>>>);
    const { generateMetadata } = await import("@/app/admin/sessions/[id]/page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "session-1" }),
      searchParams: Promise.resolve({}),
    });
    expect(absoluteTitle(metadata)).toBe(pageDocumentTitle("вечерняя"));
  });

  it("falls back when the training is missing or untitled", async () => {
    const spy = vi
      .spyOn(adminQueries, "getAdminSession")
      .mockResolvedValue(
        nullable<Awaited<ReturnType<typeof adminQueries.getAdminSession>>>(
          null,
        ),
      );
    const { generateMetadata } = await import("@/app/admin/sessions/[id]/page");
    const missing = await generateMetadata({
      params: Promise.resolve({ id: "missing" }),
      searchParams: Promise.resolve({}),
    });
    expect(absoluteTitle(missing)).toBe(pageDocumentTitle("Тренировка"));

    spy.mockResolvedValue({
      session: { title: "   " },
    } as NonNullable<Awaited<ReturnType<typeof adminQueries.getAdminSession>>>);
    const blank = await generateMetadata({
      params: Promise.resolve({ id: "blank" }),
      searchParams: Promise.resolve({}),
    });
    expect(absoluteTitle(blank)).toBe(pageDocumentTitle("Тренировка"));
  });

  it("uses the post title when editing", async () => {
    vi.spyOn(feedQueries, "getFeedPostById").mockResolvedValue({
      title: "  черновик",
    } as NonNullable<Awaited<ReturnType<typeof feedQueries.getFeedPostById>>>);
    const { generateMetadata } = await import("@/app/admin/posts/[id]/page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "post-1" }),
      searchParams: Promise.resolve({}),
    });
    expect(absoluteTitle(metadata)).toBe(pageDocumentTitle("черновик"));
  });

  it("falls back when the edited post is missing", async () => {
    vi.spyOn(feedQueries, "getFeedPostById").mockResolvedValue(
      nullable<Awaited<ReturnType<typeof feedQueries.getFeedPostById>>>(null),
    );
    const { generateMetadata } = await import("@/app/admin/posts/[id]/page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "missing" }),
      searchParams: Promise.resolve({}),
    });
    expect(absoluteTitle(metadata)).toBe(pageDocumentTitle("Редактирование"));
  });

  it("names the participant list and a participant", async () => {
    const spy = vi
      .spyOn(adminQueries, "getParticipant")
      .mockResolvedValue(
        nullable<Awaited<ReturnType<typeof adminQueries.getParticipant>>>(null),
      );
    const { generateMetadata } = await import("@/app/admin/registrations/page");
    const list = await generateMetadata({
      searchParams: Promise.resolve({}),
    });
    expect(absoluteTitle(list)).toBe(pageDocumentTitle("Участники"));
    expect(spy).not.toHaveBeenCalled();

    spy.mockResolvedValue({
      id: "user-1",
      name: "иван петров",
      email: "ivan@example.com",
    });
    const named = await generateMetadata({
      searchParams: Promise.resolve({ user: "user-1" }),
    });
    expect(absoluteTitle(named)).toBe(pageDocumentTitle("иван петров"));

    spy.mockResolvedValue({
      id: "user-2",
      name: "  ",
      email: "ivan@example.com",
    });
    const email = await generateMetadata({
      searchParams: Promise.resolve({ user: "user-2" }),
    });
    expect(absoluteTitle(email)).toBe(pageDocumentTitle("ivan@example.com"));
  });

  it("titles a published news post and a missing one", async () => {
    vi.spyOn(postImages, "listImagesForPost").mockResolvedValue([]);
    const spy = vi
      .spyOn(feedQueries, "getPublishedFeedPostBySlug")
      .mockResolvedValue(
        nullable<
          Awaited<ReturnType<typeof feedQueries.getPublishedFeedPostBySlug>>
        >(null),
      );
    const { generateMetadata } = await import("@/app/news/[slug]/page");
    const missing = await generateMetadata({
      params: Promise.resolve({ slug: "2026-10-31" }),
      searchParams: Promise.resolve({}),
    });
    expect(absoluteTitle(missing)).toBe(pageDocumentTitle("Не найдено"));

    spy.mockResolvedValue(fakePost("вечерний старт", "news"));
    const found = await generateMetadata({
      params: Promise.resolve({ slug: "2026-10-31" }),
      searchParams: Promise.resolve({}),
    });
    expect(absoluteTitle(found)).toBe(pageDocumentTitle("вечерний старт"));
  });

  it("titles an announcement and rejects the other post kind", async () => {
    vi.spyOn(postImages, "listImagesForPost").mockResolvedValue([]);
    const spy = vi
      .spyOn(feedQueries, "getPublishedFeedPostBySlug")
      .mockResolvedValue(fakePost("вечерний старт", "news"));
    const { generateMetadata } = await import("@/app/sessions/[slug]/page");
    const wrongKind = await generateMetadata({
      params: Promise.resolve({ slug: "2026-10-31" }),
      searchParams: Promise.resolve({}),
    });
    expect(absoluteTitle(wrongKind)).toBe(pageDocumentTitle("Не найдено"));

    spy.mockResolvedValue(fakePost("вечерняя", "training_announcement"));
    const announcement = await generateMetadata({
      params: Promise.resolve({ slug: "2026-10-31" }),
      searchParams: Promise.resolve({}),
    });
    expect(absoluteTitle(announcement)).toBe(pageDocumentTitle("вечерняя"));
  });

  it("keeps the site suffix off the social title", async () => {
    vi.spyOn(postImages, "listImagesForPost").mockResolvedValue([]);
    const metadata = await metadataForPublicPost(
      fakePost("вечерний старт", "news"),
    );
    expect(absoluteTitle(metadata)).toBe(pageDocumentTitle("вечерний старт"));
    expect(metadata.openGraph?.title).toBe("Вечерний старт");
    expect(metadata.twitter?.title).toBe("Вечерний старт");
  });
});
