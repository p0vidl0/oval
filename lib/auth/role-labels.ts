import type { AppRole } from "@/lib/auth/roles";
import { parseRole } from "@/lib/auth/roles";

const ROLE_LABELS: Record<AppRole, string> = {
  user: "Участник",
  editor: "Редактор",
  admin: "Админ",
  super_admin: "Супер-админ",
};

export function roleLabel(role: string | null | undefined): string {
  return ROLE_LABELS[parseRole(role)];
}
