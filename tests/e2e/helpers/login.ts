import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { countAuthOtpMails, fetchLatestAuthOtp } from "./mailslurper";

export async function loginWithEmailOtp(
  page: Page,
  email: string,
  next = "/cabinet",
): Promise<void> {
  const baselineCount = await countAuthOtpMails(email);

  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-code")).toBeVisible();

  const code = await fetchLatestAuthOtp(email, { baselineCount });
  await page.getByTestId("login-code").fill(code);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(
    new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    {
      timeout: 20_000,
    },
  );
}

export async function waitForEmailOtp(
  email: string,
  baselineCount?: number,
): Promise<string> {
  return fetchLatestAuthOtp(email, { baselineCount });
}

export function parseTelegramLoginIntentToken(deepLink: string): string {
  const match = deepLink.match(/login_([A-Za-z0-9_-]+)/);
  if (!match?.[1]) {
    throw new Error(`Cannot parse telegram intent from: ${deepLink}`);
  }
  return match[1];
}
