import { expect, type Page } from "@playwright/test";
import { markTelegramLoginIntentReady } from "@/lib/auth/telegram/login-intent";

export async function simulateTelegramBotStart(
  intentToken: string,
  telegramUserId: number,
  firstName = "E2E Telegram",
): Promise<void> {
  const ready = await markTelegramLoginIntentReady(intentToken, {
    telegramId: telegramUserId,
    chatId: telegramUserId,
    firstName,
    username: "e2e_bot_user",
  });
  if (!ready) {
    throw new Error("Telegram login intent not found or expired");
  }
}

/** Browser login: same path as after Telegram bot /start (CSRF + session cookies). */
export async function loginWithTelegramBot(
  page: Page,
  telegramUserId: number,
  next = "/cabinet",
): Promise<void> {
  await page.goto("/login");
  const { createTelegramLoginIntent } = await import(
    "@/lib/auth/telegram/login-intent"
  );
  const { token } = await createTelegramLoginIntent(next);
  await simulateTelegramBotStart(token, telegramUserId);

  const completeUrl = `/login/telegram/complete?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
  await page.goto(completeUrl);

  await page.waitForURL(
    new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    { timeout: 30_000 },
  );
  await expect(page.getByText("Нет токена входа")).toHaveCount(0);
  await expect(page.getByText("Не удалось завершить вход")).toHaveCount(0);
}
