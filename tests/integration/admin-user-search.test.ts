import { describe, expect, it } from "vitest";
import { searchUsersForAdminPaged } from "@/lib/admin/user-queries";
import { insertProviderAccount, insertUser } from "./helpers/auth-seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("admin user search for merge", () => {
  useIntegrationDb();

  it("excludes users without email and without account", async () => {
    await insertUser({
      id: "ghost-user",
      email: null,
      name: "Ghost",
    });
    await insertUser({
      id: "visible-email",
      email: "visible@oval.local",
      name: "Visible Email",
    });

    const page = await searchUsersForAdminPaged("", { page: 1, size: 10 });
    const ids = page.items.map((u) => u.id);
    expect(ids).toContain("visible-email");
    expect(ids).not.toContain("ghost-user");
  });

  it("includes telegram-only user with accounts payload", async () => {
    const tgId = await insertUser({
      id: "tg-only",
      email: null,
      name: "Telegram Only",
    });
    await insertProviderAccount(tgId, "telegram", "555001");

    const page = await searchUsersForAdminPaged("Telegram", {
      page: 1,
      size: 10,
    });
    const row = page.items.find((u) => u.id === tgId);
    expect(row).toBeDefined();
    expect(row?.accounts).toEqual([
      { providerId: "telegram", accountId: "555001" },
    ]);
  });

  it("filters by email fragment and paginates", async () => {
    for (let i = 0; i < 12; i++) {
      await insertUser({
        id: `page-user-${i}`,
        email: `page${i}@oval.local`,
        name: `Page User ${i}`,
      });
    }

    const first = await searchUsersForAdminPaged("page", { page: 1, size: 10 });
    expect(first.items).toHaveLength(10);
    expect(first.total).toBe(12);
    expect(first.pageCount).toBe(2);

    const second = await searchUsersForAdminPaged("page", {
      page: 2,
      size: 10,
    });
    expect(second.items).toHaveLength(2);
  });

  it("excludes deleted users", async () => {
    await insertUser({
      id: "deleted-search",
      email: "deleted@oval.local",
      deletedAt: new Date(),
    });

    const page = await searchUsersForAdminPaged("deleted@oval.local", {
      page: 1,
      size: 10,
    });
    expect(page.items).toHaveLength(0);
  });
});
