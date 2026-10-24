import { expect, test } from "@playwright/test";
import { loginWithEmailOtp } from "./helpers/login";
import { latestPaymentIdForRegistration } from "./helpers/payments";

test("login, register, webhook pay, cabinet", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@oval.test`;

  await loginWithEmailOtp(page, email, "/feed");
  // Участнику ссылка в админку не показывается.
  await expect(page.getByRole("link", { name: "Управлять →" })).toHaveCount(0);

  // Новый пользователь без имени: перед первой записью спрашиваем имя.
  await page.getByRole("button", { name: "Записаться" }).first().click();
  const nameDialog = page.getByRole("dialog", { name: "Как вас записать?" });
  await expect(nameDialog).toBeVisible();
  await nameDialog.getByLabel("Имя и фамилия").fill("E2E Участник");
  await Promise.all([
    page.waitForURL(/\/cabinet\/pay\//, { timeout: 15_000 }),
    nameDialog.getByRole("button", { name: "Записаться" }).click(),
  ]);

  await expect(page.getByTestId("checkout-title")).toBeVisible();
  const checkoutUrl = page.url();
  const regMatch = checkoutUrl.match(/\/cabinet\/pay\/([^/?]+)/);
  expect(regMatch?.[1]).toBeTruthy();
  const registrationId = regMatch?.[1] ?? "";

  const paymentId = await latestPaymentIdForRegistration(registrationId);

  const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? "test-webhook-secret";
  const wh = await request.post("/api/webhooks/payment/mock", {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    data: {
      event_id: `e2e-${Date.now()}`,
      payment_id: paymentId,
      status: "succeeded",
    },
  });
  expect(wh.ok()).toBeTruthy();

  await page.goto("/cabinet");
  await expect(page.getByText("оплачено").first()).toBeVisible();
});
