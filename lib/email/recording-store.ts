export type RecordedEmailOtp = { email: string; code: string; sentAt: Date };

const store = new Map<string, RecordedEmailOtp>();

export function recordEmailOtp(email: string, code: string): void {
  store.set(normalizeKey(email), {
    email: normalizeKey(email),
    code,
    sentAt: new Date(),
  });
}

export function getLatestEmailOtp(email: string): RecordedEmailOtp | null {
  return store.get(normalizeKey(email)) ?? null;
}

export function clearEmailRecordingStore(): void {
  store.clear();
}

function normalizeKey(email: string): string {
  return email.trim().toLowerCase();
}
