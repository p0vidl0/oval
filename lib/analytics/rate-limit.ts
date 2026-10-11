const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 120;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function checkAnalyticsRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= MAX_PER_WINDOW) {
    return false;
  }
  bucket.count += 1;
  return true;
}

/** Тесты: сброс in-memory лимитов. */
export function resetAnalyticsRateLimitsForTests(): void {
  buckets.clear();
}
