import { describe, expect, it } from "vitest";
import { activeAdminNavHref, buildAdminMenu } from "@/lib/admin/routes";

const hrefs = [
  "/admin/sessions",
  "/admin/posts",
  "/admin/users",
  "/admin/users/merge",
];

describe("activeAdminNavHref", () => {
  it("matches the section and its nested pages", () => {
    expect(activeAdminNavHref("/admin/sessions", hrefs)).toBe(
      "/admin/sessions",
    );
    expect(activeAdminNavHref("/admin/sessions/abc", hrefs)).toBe(
      "/admin/sessions",
    );
  });

  it("prefers the longest prefix", () => {
    expect(activeAdminNavHref("/admin/users/merge", hrefs)).toBe(
      "/admin/users/merge",
    );
    expect(activeAdminNavHref("/admin/users", hrefs)).toBe("/admin/users");
  });

  it("does not match by partial segment", () => {
    expect(activeAdminNavHref("/admin/postsx", hrefs)).toBeNull();
    expect(activeAdminNavHref("/admin", hrefs)).toBeNull();
  });
});

describe("activeAdminNavHref with the home item", () => {
  const withHome = ["/admin", ...hrefs];

  it("home matches only itself", () => {
    expect(activeAdminNavHref("/admin", withHome)).toBe("/admin");
    expect(activeAdminNavHref("/admin/sessions/abc", withHome)).toBe(
      "/admin/sessions",
    );
    expect(activeAdminNavHref("/admin/unknown", withHome)).toBeNull();
  });
});

describe("buildAdminMenu", () => {
  const labels = (role: string) =>
    buildAdminMenu(role).map((g) => [g.label, g.items.map((i) => i.label)]);

  it("admin sees everything except users and merge", () => {
    expect(labels("admin")).toEqual([
      ["Тренировки", ["Сегодня", "Расписание"]],
      ["Люди", ["Участники"]],
      ["Деньги", ["Оплата"]],
      ["Контент", ["Публикации"]],
      ["Система", ["Статистика"]],
    ]);
  });

  it("super_admin also manages users", () => {
    expect(
      buildAdminMenu("super_admin")
        .at(-1)
        ?.items.map((i) => i.label),
    ).toEqual(["Статистика", "Пользователи", "Склейка"]);
  });

  it("participant gets no menu", () => {
    expect(buildAdminMenu("user")).toEqual([]);
  });
});

describe("session page tabs", () => {
  it("parses new and legacy tab keys", async () => {
    const { parseTab, tabHref } = await import(
      "@/app/admin/sessions/[id]/tabs"
    );
    expect(parseTab(undefined)).toBe("list");
    expect(parseTab("participants")).toBe("list");
    expect(parseTab("history")).toBe("journal");
    expect(parseTab("posts")).toBe("posts");
    expect(tabHref("s1", "list", { filter: "paid" })).toBe(
      "/admin/sessions/s1?filter=paid",
    );
    expect(tabHref("s1", "journal")).toBe("/admin/sessions/s1?tab=journal");
  });
});

describe("feed manage link", () => {
  it("only staff sees it, pointing to the admin session page", async () => {
    const { adminSessionHref, canManageSessionFromFeed } = await import(
      "@/lib/admin/routes"
    );
    expect(canManageSessionFromFeed("admin")).toBe(true);
    expect(canManageSessionFromFeed("super_admin")).toBe(true);
    expect(canManageSessionFromFeed("user")).toBe(false);
    expect(canManageSessionFromFeed(undefined)).toBe(false);
    expect(adminSessionHref("s1")).toBe("/admin/sessions/s1");
  });
});
