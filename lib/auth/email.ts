/** Normalize and validate email for auth. Returns null if invalid. */
export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }
  if (trimmed.length > 254) {
    return null;
  }
  return trimmed;
}
