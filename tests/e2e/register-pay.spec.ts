import { expect, test } from "@playwright/test";

test("login, register, webhook pay, cabinet", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@oval.test`;

  await page.goto("/login?next=/feed");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-code")).toBeVisible();

  let code: string | undefined;
  for (let attempt = 0; attempt < 25; attempt++) {
    const emailRes = await request.get(
      `/api/test/email/latest?email=${encodeURIComponent(email)}`,
    );
    if (emailRes.ok()) {
      code = (await emailRes.json()).code;
      break;
    }
    await page.waitForTimeout(200);
  }
  expect(code).toBeTruthy();

  await page.getByTestId("login-code").fill(code ?? "");
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/feed/, { timeout: 15_000 });

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

  const latestPay = await request.get(
    `/api/test/payments/latest?registration_id=${registrationId}`,
  );
  expect(latestPay.ok()).toBeTruthy();
  const { payment_id: paymentId } = await latestPay.json();

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
