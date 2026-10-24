import { expect, test } from "@playwright/test";
import { loginWithEmailOtp } from "./helpers/login";
import { seedE2eScenario } from "./helpers/scenarios";

test.describe("admin: Сегодня → список → отметка и оплата", () => {
  test.setTimeout(60_000);

  test("coach marks attendance and on-site cash", async ({ page }) => {
    const seed = await seedE2eScenario("admin-today", `t-${Date.now()}`);
    if (seed.scenario !== "admin-today") throw new Error("unexpected seed");

    await loginWithEmailOtp(page, seed.superAdminEmail, "/admin");
    await page.goto("/admin");
    await expect(page.locator(".nl-admin-today")).toBeVisible();

    // Из карточки анонса — сразу в тренировку в админке.
    await page.goto(`/feed/${seed.postId}`);
    await page.getByRole("link", { name: "Управлять →" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/sessions/${seed.sessionId}$`),
    );
    const row = page.locator(".nl-list-row", { hasText: seed.participantName });
    await expect(row).toContainText("Ждёт оплаты");

    // Отметка видна сразу и переживает обновление страницы.
    await row.getByRole("button", { name: "Был", exact: true }).click();
    await expect(
      row.getByRole("button", { name: "Был", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // Дождаться ответа сервера, прежде чем перезагружать.
    await expect(row.locator(".nl-attendance")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(row.locator(".nl-error-text")).toHaveCount(0);
    await page.reload();
    await expect(
      page
        .locator(".nl-list-row", { hasText: seed.participantName })
        .getByRole("button", { name: "Был", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".nl-participants-toolbar")).toContainText(
      "отмечено 1 из 1 · пришли 1",
    );

    // «Оплачено» → способ в диалоге двумя крупными кнопками.
    await row.getByRole("button", { name: "Оплачено", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Отметить оплату" });
    await expect(dialog).toContainText(seed.participantName);
    await dialog.getByRole("button", { name: "Переводом" }).click();
    await expect(row).toContainText("Оплачено ·");
    await expect(row).toContainText("переводом");

    // Возврат — в меню «…».
    await row.getByRole("button", { name: "Действия с записью" }).click();
    await expect(row.getByRole("menuitem", { name: "Возврат" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(row.getByRole("menuitem", { name: "Возврат" })).toBeHidden();

    await page.getByRole("link", { name: "Журнал" }).click();
    await expect(
      page.getByText(`Отмечен: был: ${seed.participantName}`),
    ).toBeVisible();
    await expect(
      page.getByText(`Оплачено переводом: ${seed.participantName}`),
    ).toBeVisible();
  });
});
