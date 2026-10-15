import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function loginWithEmailOtp(
  page: Page,
  request: APIRequestContext,
  email: string,
  next = "/cabinet",
): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-code")).toBeVisible();

  let code: string | undefined;
  for (let attempt = 0; attempt < 50; attempt++) {
    const emailRes = await request.get(
      `/api/test/email/latest?email=${encodeURIComponent(email)}`,
    );
    if (emailRes.ok()) {
      code = (await emailRes.json()).code as string;
      break;
    }
    await page.waitForTimeout(200);
  }
  expect(code).toBeTruthy();

  await page.getByTestId("login-code").fill(code ?? "");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(
    new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    {
      timeout: 20_000,
    },
  );
}

export async function loginWithTelegramBot(
  page: Page,
  _request: APIRequestContext,
  telegramUserId: number,
  next = "/cabinet",
): Promise<void> {
  const params = new URLSearchParams({
    telegramUserId: String(telegramUserId),
    firstName: "E2E Telegram",
    next,
  });
  await page.goto(`/api/test/e2e/telegram-sign-in?${params.toString()}`);
  await page.waitForURL(
    new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    { timeout: 20_000 },
  );
}

export async function waitForEmailOtp(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const res = await request.get(
      `/api/test/email/latest?email=${encodeURIComponent(email)}`,
    );
    if (res.ok()) {
      const code = (await res.json()).code as string;
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No OTP recorded for ${email}`);
}

export function parseTelegramLoginIntentToken(deepLink: string): string {
  const match = deepLink.match(/login_([A-Za-z0-9_-]+)/);
  if (!match?.[1]) {
    throw new Error(`Cannot parse telegram intent from: ${deepLink}`);
  }
  return match[1];
}
