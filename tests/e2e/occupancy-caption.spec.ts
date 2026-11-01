import { expect, test } from "@playwright/test";
import { seedOccupancyCaptionE2e } from "./helpers/scenarios";

test("open registration shows spots left; a started session shows the headcount", async ({
  page,
}) => {
  const seed = await seedOccupancyCaptionE2e(String(Date.now()));

  await page.goto(`/sessions/${seed.open.postSlug}`);
  const openCard = page.locator("article", { hasText: seed.open.title });
  await expect(
    openCard.getByRole("link", { name: "Записаться" }),
  ).toBeVisible();
  await expect(openCard.getByText("Занято 0 из 25")).toBeVisible();
  await expect(openCard.getByText("осталось 25 мест")).toBeVisible();
  await expect(openCard.locator(".nl-progress__track")).toBeVisible();

  await page.goto(`/sessions/${seed.closed.postSlug}`);
  const closedCard = page.locator("article", { hasText: seed.closed.title });
  await expect(
    closedCard.getByRole("link", { name: "Записаться" }),
  ).toHaveCount(0);
  await expect(
    closedCard.getByRole("button", { name: "Записаться" }),
  ).toHaveCount(0);
  await expect(closedCard.getByText("0 участников")).toBeVisible();
  await expect(closedCard.getByText(/осталось/)).toHaveCount(0);
  await expect(closedCard.locator(".nl-progress__track")).toBeVisible();
});
