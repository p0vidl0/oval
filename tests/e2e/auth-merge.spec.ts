import { expect, test } from "@playwright/test";
import {
  loginWithEmailOtp,
  loginWithTelegramBot,
  parseTelegramLoginIntentToken,
  waitForEmailOtp,
} from "./helpers/login";

test.describe("auth link and user merge", () => {
  test.setTimeout(60_000);
  test("cabinet: link email triggers self-merge confirm", async ({
    page,
    request,
  }) => {
    const runId = `em-${Date.now()}`;
    const seedRes = await request.post("/api/test/e2e/seed", {
      data: { scenario: "email-merge-victim", runId },
    });
    expect(seedRes.ok()).toBeTruthy();
    const { victimEmail } = (await seedRes.json()) as { victimEmail: string };

    const telegramUserId = 910_000_000 + (Date.now() % 89_000_000);
    await loginWithTelegramBot(page, request, telegramUserId, "/cabinet");

    await page.goto("/cabinet#auth-methods");
    await expect(page.getByTestId("auth-methods")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("auth-link-add-email").click();
    await expect(page.getByTestId("auth-link-email-input")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByTestId("auth-link-email-input").fill(victimEmail);
    await page.getByRole("button", { name: "Получить код" }).click();
    await expect(page.getByTestId("auth-link-otp-input")).toBeVisible({
      timeout: 15_000,
    });

    const otp = await waitForEmailOtp(request, victimEmail);
    await page.getByTestId("auth-link-otp-input").fill(otp);
    await page.getByRole("button", { name: "Подтвердить" }).click();

    await expect(page.getByTestId("auth-merge-confirm")).toBeVisible();
    await page.getByTestId("auth-merge-confirm").click();

    await expect(page.getByTestId("auth-methods")).toContainText(victimEmail);
    await expect(page.getByTestId("auth-link-add-email")).toHaveCount(0);
  });

  test("cabinet: link Telegram via bot intent", async ({ page, request }) => {
    const runId = `tg-${Date.now()}`;
    const actorEmail = `e2e-tg-${runId}@oval.test`;
    await loginWithEmailOtp(page, request, actorEmail, "/cabinet");

    await page.goto("/cabinet#auth-methods");
    await page.getByTestId("auth-link-add-telegram").click();

    const deeplink = page.getByTestId("telegram-bot-deeplink");
    await expect(deeplink).toBeVisible({ timeout: 15_000 });
    const href = await deeplink.getAttribute("href");
    expect(href).toBeTruthy();
    const intentToken = parseTelegramLoginIntentToken(href ?? "");

    const telegramUserId = 900_000_000 + (Date.now() % 99_000_000);
    const sim = await request.post("/api/test/telegram/simulate-start", {
      data: {
        intentToken,
        telegramUserId,
        firstName: "E2E TG",
      },
    });
    expect(sim.ok()).toBeTruthy();

    await page.waitForURL(/\/cabinet.*link=ok/, { timeout: 30_000 });
    await expect(page.getByTestId("auth-methods")).toContainText("Telegram");
    await expect(page.getByTestId("auth-link-add-telegram")).toHaveCount(0);
  });

  test("admin: merge preview blocks payment conflict", async ({
    page,
    request,
  }) => {
    const runId = `conf-${Date.now()}`;
    const seedRes = await request.post("/api/test/e2e/seed", {
      data: { scenario: "admin-payment-conflict", runId },
    });
    expect(seedRes.ok()).toBeTruthy();
    const { superAdminEmail, targetSearch, sourceSearch } =
      (await seedRes.json()) as {
        superAdminEmail: string;
        targetSearch: string;
        sourceSearch: string;
      };

    await loginWithEmailOtp(
      page,
      request,
      superAdminEmail,
      "/admin/users/merge",
    );
    await expect(
      page.getByRole("heading", { name: "Склейка пользователей" }),
    ).toBeVisible();

    await page.getByTestId("admin-merge-target-search").fill(targetSearch);
    const conflictTargetOption = page.getByRole("option", {
      name: new RegExp(targetSearch),
    });
    await expect(conflictTargetOption).toBeVisible({ timeout: 10_000 });
    await conflictTargetOption.click();

    await page.getByTestId("admin-merge-source-search").fill(sourceSearch);
    const conflictSourceOption = page.getByRole("option", {
      name: new RegExp(sourceSearch),
    });
    await expect(conflictSourceOption).toBeVisible({ timeout: 10_000 });
    await conflictSourceOption.click();

    await page.getByTestId("admin-merge-preview").click();
    await expect(
      page.getByText("Конфликт оплат за одну тренировку"),
    ).toBeVisible();
    await expect(page.getByTestId("admin-merge-execute")).toHaveCount(0);
  });

  test("admin: merge without payment conflict", async ({ page, request }) => {
    const runId = `ok-${Date.now()}`;
    const seedRes = await request.post("/api/test/e2e/seed", {
      data: { scenario: "admin-merge-success", runId },
    });
    expect(seedRes.ok()).toBeTruthy();
    const { superAdminEmail, targetSearch, sourceSearch } =
      (await seedRes.json()) as {
        superAdminEmail: string;
        targetSearch: string;
        sourceSearch: string;
      };

    await loginWithEmailOtp(
      page,
      request,
      superAdminEmail,
      "/admin/users/merge",
    );

    await page.getByTestId("admin-merge-target-search").fill(targetSearch);
    const okTargetOption = page.getByRole("option", {
      name: new RegExp(targetSearch),
    });
    await expect(okTargetOption).toBeVisible({ timeout: 10_000 });
    await okTargetOption.click();

    await page.getByTestId("admin-merge-source-search").fill(sourceSearch);
    const okSourceOption = page.getByRole("option", {
      name: new RegExp(sourceSearch),
    });
    await expect(okSourceOption).toBeVisible({ timeout: 10_000 });
    await okSourceOption.click();

    await page.getByTestId("admin-merge-preview").click();
    await expect(page.getByTestId("admin-merge-execute")).toBeVisible();

    page.once("dialog", (dialog) => {
      expect(dialog.type()).toBe("confirm");
      void dialog.accept();
    });
    await page.getByTestId("admin-merge-execute").click();

    await expect(page.getByTestId("admin-merge-execute")).toHaveCount(0);
    await page.getByTestId("admin-merge-source-search").fill(sourceSearch);
    await expect(page.getByText("Никого не найдено")).toBeVisible({
      timeout: 10_000,
    });
  });
});
