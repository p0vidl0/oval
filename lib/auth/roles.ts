export const ROLES = ["user", "editor", "admin", "super_admin"] as const;
export type AppRole = (typeof ROLES)[number];

export function parseRole(role: string | null | undefined): AppRole {
  if (role === "admin" || role === "editor" || role === "super_admin") {
    return role;
  }
  return "user";
}

export function canAccessAdmin(role: string | null | undefined): boolean {
  const r = parseRole(role);
  return r === "admin" || r === "editor" || r === "super_admin";
}

export function isAdmin(role: string | null | undefined): boolean {
  const r = parseRole(role);
  return r === "admin" || r === "super_admin";
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return parseRole(role) === "super_admin";
}
