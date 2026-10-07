export const ROLES = ["user", "editor", "admin"] as const;
export type AppRole = (typeof ROLES)[number];

export function parseRole(role: string | null | undefined): AppRole {
  if (role === "admin" || role === "editor") {
    return role;
  }
  return "user";
}

export function canAccessAdmin(role: string | null | undefined): boolean {
  const r = parseRole(role);
  return r === "admin" || r === "editor";
}

export function isAdmin(role: string | null | undefined): boolean {
  return parseRole(role) === "admin";
}
