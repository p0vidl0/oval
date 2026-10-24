import type { ParticipantsFilter } from "@/lib/training/admin-queries";

export type Tab = "list" | "settings" | "posts" | "journal";

export const TABS: { key: Tab; label: string }[] = [
  { key: "list", label: "Список" },
  { key: "settings", label: "Параметры" },
  { key: "posts", label: "Публикации" },
  { key: "journal", label: "Журнал" },
];

/** Старые ссылки: `participants` → «Список», `history` → «Журнал». */
export function parseTab(raw: string | undefined): Tab {
  switch (raw) {
    case "settings":
    case "posts":
    case "journal":
      return raw;
    case "history":
      return "journal";
    default:
      return "list";
  }
}

export function parseFilter(raw: string | undefined): ParticipantsFilter {
  return raw === "unpaid" || raw === "paid" || raw === "closed"
    ? raw
    : "active";
}

export function tabHref(id: string, tab: Tab, extra?: Record<string, string>) {
  const params = new URLSearchParams({
    ...(tab === "list" ? {} : { tab }),
    ...extra,
  }).toString();
  return `/admin/sessions/${id}${params ? `?${params}` : ""}`;
}
