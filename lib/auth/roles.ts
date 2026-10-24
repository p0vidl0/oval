export const ROLES = ["user", "admin", "super_admin"] as const;
export type AppRole = (typeof ROLES)[number];

export function parseRole(role: string | null | undefined): AppRole {
  if (role === "admin" || role === "super_admin") {
    return role;
  }
  return "user";
}

/** Свойство самой роли (не право доступа): super_admin нельзя менять и склеивать. */
export function isSuperAdmin(role: string | null | undefined): boolean {
  return parseRole(role) === "super_admin";
}
