export type OtpSendLimitConfig = {
  minIntervalSec: number;
  maxPerEmailPerDay: number;
  maxSmtpPerHour: number;
};

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

export function readOtpSendLimitConfig(): OtpSendLimitConfig {
  return {
    minIntervalSec: readIntEnv("EMAIL_OTP_MIN_INTERVAL_SEC", 120),
    maxPerEmailPerDay: readIntEnv("EMAIL_OTP_MAX_PER_EMAIL_PER_DAY", 10),
    maxSmtpPerHour: readIntEnv("EMAIL_OTP_MAX_SMTP_PER_HOUR", 200),
  };
}

export type OtpSendLimitSnapshot = {
  now: Date;
  lastSentAt: Date | null;
  sendsLast24h: number;
  sendsLastHourGlobal: number;
  config: OtpSendLimitConfig;
};

export function decideOtpSendAllowed(
  snapshot: OtpSendLimitSnapshot,
): { allowed: true } | { allowed: false; reason: string } {
  const { now, lastSentAt, sendsLast24h, sendsLastHourGlobal, config } =
    snapshot;

  if (sendsLastHourGlobal >= config.maxSmtpPerHour) {
    return { allowed: false, reason: "global_hourly_cap" };
  }

  if (sendsLast24h >= config.maxPerEmailPerDay) {
    return { allowed: false, reason: "per_email_daily_cap" };
  }

  if (lastSentAt && config.minIntervalSec > 0) {
    const elapsedSec = (now.getTime() - lastSentAt.getTime()) / 1000;
    if (elapsedSec < config.minIntervalSec) {
      return { allowed: false, reason: "per_email_interval" };
    }
  }

  return { allowed: true };
}
