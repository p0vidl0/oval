import { expect, test } from "@playwright/test";
import {
  seedAnnouncementPublicUrlE2e,
  seedFeedPostPublicUrlE2e,
} from "./helpers/scenarios";

test.describe("public post slug URLs", () => {
  test("news opens at /news/{slug}; legacy paths redirect", async ({
    page,
  }) => {
    const seed = await seedFeedPostPublicUrlE2e(String(Date.now()));

    await page.goto(`/news/${seed.postSlug}`);
    await expect(
      page.getByRole("heading", { level: 2, name: seed.title }),
    ).toBeVisible();

    const root = await page.goto(`/${seed.postSlug}`);
    expect(root?.ok()).toBe(true);
    await expect(page).toHaveURL(
      new RegExp(`/news/${escapeRegExp(seed.postSlug)}$`),
    );

    const legacy = await page.goto(`/feed/${seed.postId}`);
    expect(legacy?.ok()).toBe(true);
    await expect(page).toHaveURL(
      new RegExp(`/news/${escapeRegExp(seed.postSlug)}$`),
    );
  });

  test("announcement opens at /sessions/{slug}", async ({ page }) => {
    const seed = await seedAnnouncementPublicUrlE2e(String(Date.now()));

    await page.goto(`/sessions/${seed.postSlug}`);
    await expect(
      page.getByRole("heading", { level: 2, name: seed.title }),
    ).toBeVisible();

    const root = await page.goto(`/${seed.postSlug}`);
    expect(root?.ok()).toBe(true);
    await expect(page).toHaveURL(
      new RegExp(`/sessions/${escapeRegExp(seed.postSlug)}$`),
    );
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
