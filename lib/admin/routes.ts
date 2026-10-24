import { type Capability, can } from "@/lib/auth/capabilities";

/** Стартовая страница админки: экран «Сегодня» вокруг ближайшей тренировки. */
export const ADMIN_HOME = "/admin";

/** Тренировка в админке: список участников, оплата, отметки. */
export function adminSessionHref(sessionId: string) {
  return `/admin/sessions/${sessionId}`;
}

/** Показывать ссылку «Управлять» из ленты: тот, кто ведёт участников. */
export function canManageSessionFromFeed(role: string | null | undefined) {
  return can(role, "registrations.manage") || can(role, "attendance.mark");
}

export type AdminMenuItem = { href: string; label: string };
export type AdminMenuGroup = { label: string; items: AdminMenuItem[] };

const MENU: {
  label: string;
  items: (AdminMenuItem & { capability: Capability })[];
}[] = [
  {
    label: "Тренировки",
    items: [
      { href: ADMIN_HOME, label: "Сегодня", capability: "sessions.manage" },
      {
        href: "/admin/sessions",
        label: "Расписание",
        capability: "sessions.manage",
      },
    ],
  },
  {
    label: "Люди",
    items: [
      {
        href: "/admin/registrations",
        label: "Участники",
        capability: "registrations.manage",
      },
    ],
  },
  {
    label: "Деньги",
    items: [
      {
        href: "/admin/payments",
        label: "Оплата",
        capability: "payments.refund",
      },
    ],
  },
  {
    label: "Контент",
    items: [
      { href: "/admin/posts", label: "Публикации", capability: "feed.publish" },
    ],
  },
  {
    label: "Система",
    items: [
      {
        href: "/admin/analytics",
        label: "Статистика",
        capability: "analytics.view",
      },
      {
        href: "/admin/users",
        label: "Пользователи",
        capability: "users.manageRoles",
      },
      {
        href: "/admin/users/merge",
        label: "Склейка",
        capability: "users.merge",
      },
    ],
  },
];

/** Меню админки по задачам: только доступные роли пункты, без пустых групп. */
export function buildAdminMenu(
  role: string | null | undefined,
): AdminMenuGroup[] {
  return MENU.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => can(role, item.capability))
      .map(({ href, label }) => ({ href, label })),
  })).filter((group) => group.items.length > 0);
}

/**
 * Пункт меню админки для текущего пути: самый длинный совпавший префикс,
 * чтобы `/admin/users/merge` не подсвечивал «Пользователи». Стартовый
 * `/admin` совпадает только точно — иначе он был бы префиксом всего.
 */
export function activeAdminNavHref(
  pathname: string,
  hrefs: readonly string[],
): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches =
      pathname === href ||
      (href !== ADMIN_HOME && pathname.startsWith(`${href}/`));
    if (matches && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}
