import { createHash, timingSafeEqual } from "node:crypto";

/** Сравнение секретов без утечки по длине и по времени. */
export function secretsMatch(presented: string, expected: string): boolean {
  const left = createHash("sha256").update(presented).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}
