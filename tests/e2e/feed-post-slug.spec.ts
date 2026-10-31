import { expect, test } from "@playwright/test";
import { seedFeedPostPublicUrlE2e } from "./helpers/scenarios";

test.describe("public post slug URLs", () => {
  test("material opens at /{slug}; /feed/{id} redirects to canonical path", async ({
    page,
  }) => {
    const seed = await seedFeedPostPublicUrlE2e(String(Date.now()));

    await page.goto(`/${seed.postSlug}`);
    await expect(
      page.getByRole("heading", { level: 2, name: seed.title }),
    ).toBeVisible();

    const response = await page.goto(`/feed/${seed.postId}`);
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveURL(
      new RegExp(`/${escapeRegExp(seed.postSlug)}$`),
    );
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
