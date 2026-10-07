/**
 * Аватар и подпись пользователя в шапке.
 * Без имени — первая буква email и сам email.
 */
export function userHeaderDisplay(user: {
  name?: string | null;
  email?: string | null;
}): { initials: string; label: string; isEmail: boolean } {
  const name = user.name?.trim() ?? "";
  if (!name) {
    const email = user.email?.trim() ?? "";
    return {
      initials: (email[0] ?? "?").toUpperCase(),
      label: email || "Участник",
      isEmail: Boolean(email),
    };
  }
  const parts = name.split(/\s+/);
  return {
    initials: parts
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    // «Анна Петрова» → «Анна»
    label: parts[0] ?? name,
    isEmail: false,
  };
}
