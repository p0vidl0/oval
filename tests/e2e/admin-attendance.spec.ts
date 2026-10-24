import { expect, type Locator, type Page, test } from "@playwright/test";
import { loginWithEmailOtp } from "./helpers/login";
import { type E2eSeedResult, seedE2eScenario } from "./helpers/scenarios";

type AttendanceSeed = Extract<E2eSeedResult, { scenario: "admin-attendance" }>;

async function seed(): Promise<AttendanceSeed> {
  const result = await seedE2eScenario(
    "admin-attendance",
    `a-${Date.now()}-${Math.round(Math.random() * 1000)}`,
  );
  if (result.scenario !== "admin-attendance")
    throw new Error("unexpected seed");
  return result;
}

function row(page: Page, name: string) {
  return page.locator(".nl-list-row", { hasText: name });
}

function button(scope: Locator, name: string) {
  return scope.getByRole("button", { name, exact: true });
}

/** Отметка ушла на сервер — можно перезагружать и проверять. */
async function settled(scope: Locator) {
  await expect(scope.locator(".nl-attendance")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(scope.locator(".nl-error-text")).toHaveCount(0);
}

test.describe("admin: посещаемость", () => {
  test.setTimeout(90_000);

  test("no-show, search, walk-in and «rest didn't come»", async ({ page }) => {
    const s = await seed();
    const [alpha, bravo, charlie] = s.due;
    await loginWithEmailOtp(page, s.superAdminEmail, "/admin");
    await page.goto(`/admin/sessions/${s.sessionId}`);

    // «Не был» без оплаты: не долг, «Оплачено» уходит в «…».
    const a = row(page, alpha.name);
    await expect(button(a, "Оплачено")).toBeVisible();
    await button(a, "Не был").click();
    await settled(a);
    await page.reload();
    const aAfter = row(page, alpha.name);
    await expect(button(aAfter, "Не был")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(aAfter).toContainText("Без оплаты");
    await expect(button(aAfter, "Оплачено")).toHaveCount(0);
    await button(aAfter, "Действия с записью").click();
    await expect(
      aAfter.getByRole("menuitem", { name: "Оплачено…" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Поиск по имени фильтрует строки без запроса.
    const search = page.getByRole("searchbox", { name: "Поиск участника" });
    await search.fill(bravo.name.toLowerCase());
    await expect(row(page, bravo.name)).toBeVisible();
    await expect(row(page, charlie.name)).toBeHidden();
    await search.fill("");
    await expect(row(page, charlie.name)).toBeVisible();

    // «Пришёл без записи»: поиск пользователя → сразу «Был», с пометкой.
    await page.getByRole("button", { name: "Пришёл без записи…" }).click();
    const dialog = page.getByRole("dialog", { name: "Пришёл без записи" });
    await dialog.getByPlaceholder("Имя, email или id").fill(s.walkIn.email);
    await dialog
      .getByRole("option", { name: new RegExp(s.walkIn.name) })
      .click();
    await dialog.getByRole("button", { name: "Добавить" }).click();
    await expect(dialog).toBeHidden();
    const w = row(page, s.walkIn.name);
    await expect(w).toContainText("без записи");
    await expect(button(w, "Был")).toHaveAttribute("aria-pressed", "true");

    // «Остальные не пришли»: Bravo и Charlie ещё не отмечены.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Остальные не пришли (2)" }).click();
    await expect(
      page.getByRole("button", { name: /Остальные не пришли/ }),
    ).toHaveCount(0);
    for (const name of [bravo.name, charlie.name]) {
      await expect(button(row(page, name), "Не был")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await expect(page.locator(".nl-participants-toolbar")).toContainText(
      "отмечено 5 из 5",
    );
  });

  test("mobile: row actions stay inside the screen", async ({ page }) => {
    const s = await seed();
    await page.setViewportSize({ width: 375, height: 812 });
    await loginWithEmailOtp(page, s.superAdminEmail, "/admin");
    await page.goto(`/admin/sessions/${s.sessionId}`);
    const r = row(page, s.due[0].name);
    for (const name of ["Был", "Не был", "Оплачено", "Действия с записью"]) {
      const box = await button(r, name).boundingBox();
      expect(box, name).not.toBeNull();
      if (!box) continue;
      expect(box.x, `${name} left`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${name} right`).toBeLessThanOrEqual(375);
    }
  });

  test("two coaches see each other's marks", async ({ page, context }) => {
    const s = await seed();
    const name = s.due[1].name;
    await loginWithEmailOtp(page, s.superAdminEmail, "/admin");
    const other = await context.newPage();
    await other.goto(`/admin/sessions/${s.sessionId}`);
    await page.goto(`/admin/sessions/${s.sessionId}`);
    await expect(button(row(other, name), "Был")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await button(row(page, name), "Был").click();
    await settled(row(page, name));
    // Вторая вкладка обновляется по SSE `session.attendance_changed`.
    await expect(button(row(other, name), "Был")).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 10_000 },
    );
  });

  test("the result banner shows once", async ({ page }) => {
    const s = await seed();
    await loginWithEmailOtp(page, s.superAdminEmail, "/admin");
    await page.goto(`/admin/sessions/${s.sessionId}?tab=settings`);
    await page.getByRole("button", { name: "Сохранить параметры" }).click();
    await expect(page.getByText("Параметры сохранены.")).toBeVisible();
    await expect(page).not.toHaveURL(/done=/);
    await page.reload();
    await expect(page.getByText("Параметры сохранены.")).toHaveCount(0);
  });

  test("participant sees attendance in the cabinet, without admin links", async ({
    page,
  }) => {
    const s = await seed();
    await loginWithEmailOtp(page, s.attended.email, "/cabinet");
    await page.goto("/cabinet");
    await expect(page.getByText(/1 тренировка в \d{4}/)).toBeVisible();
    await expect(
      page.locator(".nl-cabinet-history__row", { hasText: "E2E Attendance" }),
    ).toContainText("Был · оплачено");
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("attendance buttons appear when the window opens, without reload", async ({
    page,
  }) => {
    const result = await seedE2eScenario(
      "admin-window-soon",
      `w-${Date.now()}`,
    );
    if (result.scenario !== "admin-window-soon")
      throw new Error("unexpected seed");
    await loginWithEmailOtp(page, result.superAdminEmail, "/admin");
    await page.goto(`/admin/sessions/${result.sessionId}`);
    const r = row(page, result.participantName);
    await expect(r).toBeVisible();
    const opensAt = Date.parse(result.opensAt);
    if (Date.now() < opensAt - 2000) {
      await expect(button(r, "Был")).toHaveCount(0);
    }
    // Без перезагрузки: маркер в window переживает только мягкий refresh.
    await page.evaluate(() => {
      (window as unknown as { __noReload?: boolean }).__noReload = true;
    });
    await expect(button(r, "Был")).toBeVisible({
      timeout: Math.max(5_000, opensAt - Date.now() + 15_000),
    });
    expect(
      await page.evaluate(
        () => (window as unknown as { __noReload?: boolean }).__noReload,
      ),
    ).toBe(true);
  });
});
