import { expect, test } from "@playwright/test";
import { E2E_POST_TITLE } from "./constants";

test("guest opens feed and announcement", async ({ page }) => {
  await page.goto("/feed");
  const allFilter = page.getByRole("link", { name: "Все" });
  await expect(allFilter).toBeVisible();
  await expect(allFilter).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: E2E_POST_TITLE }),
  ).toBeVisible();
});
