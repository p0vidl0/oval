import { expect, test } from "@playwright/test";
import { loginWithEmailOtp } from "./helpers/login";
import { seedE2eScenario } from "./helpers/scenarios";

test.describe("admin: отправка в Telegram после ошибки", () => {
  test("retry and «already in channel» ask for confirmation", async ({
    page,
  }) => {
    const s = await seedE2eScenario(
      "admin-telegram-failed",
      `tg-${Date.now()}`,
    );
    if (s.scenario !== "admin-telegram-failed")
      throw new Error("unexpected seed");
    await loginWithEmailOtp(page, s.superAdminEmail, "/admin");
    await page.goto(`/admin/posts/${s.postId}`);

    const status = page.locator("[data-telegram-status]");
    await expect(status).toHaveAttribute("data-telegram-status", "failed");
    await expect(status).toContainText("результат неизвестен");
    const retry = status.getByRole("button", {
      name: "Отправить в Telegram ещё раз",
    });
    const markSent = status.getByRole("button", { name: "Пост уже в канале" });

    // Отмена в confirm — ничего не происходит.
    let message = "";
    page.once("dialog", (d) => {
      message = d.message();
      void d.dismiss();
    });
    await retry.click();
    expect(message).toContain("проверьте канал");
    await expect(page).not.toHaveURL(/done=|error=/);
    await expect(status).toHaveAttribute("data-telegram-status", "failed");

    // Подтвердили, но канал в e2e не настроен — ошибка, статус прежний.
    page.once("dialog", (d) => void d.accept());
    await retry.click();
    await expect(page.getByText("Telegram-канал не настроен")).toBeVisible();
    await expect(status).toHaveAttribute("data-telegram-status", "failed");

    page.once("dialog", (d) => void d.accept());
    await markSent.click();
    await expect(
      page.getByText("Отмечено: публикация уже в Telegram-канале."),
    ).toBeVisible();
    await expect(status).toHaveAttribute("data-telegram-status", "sent");
    await expect(retry).toHaveCount(0);
  });
});
