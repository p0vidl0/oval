# Email (OTP / Postbox)

Sign-in OTP: [`lib/email/send-otp.ts`](../../lib/email/send-otp.ts) → SMTP via [`lib/email/send-via-smtp.ts`](../../lib/email/send-via-smtp.ts).

## Providers (`EMAIL_PROVIDER`)

| Value | Use |
|-------|-----|
| `stub` | Dev: log OTP to console |
| `recording` | Integration / e2e: in-memory store + [`/api/test/email/latest`](../../app/api/test/email/latest/route.ts) |
| `smtp` | Production (Yandex Postbox or Mailpit) |

## Production (Yandex Postbox)

Set on the app host (secrets manager / env, never commit):

```bash
EMAIL_PROVIDER=smtp
OVAL_TEST_API=0

SMTP_HOST=postbox.cloud.yandex.net   # use value from Postbox console
SMTP_PORT=587                        # or 465 with SMTP_SECURE=1
SMTP_SECURE=0                        # 1 for implicit TLS (typical 465)
SMTP_USER=<postbox-identity-or-login>
SMTP_PASS=<api-key-or-password>
SMTP_FROM=noreply@your-verified-domain.ru
```

Configure SPF, DKIM, DMARC for the sending domain in Yandex Cloud. Use a dedicated subdomain for transactional mail when possible.

### OTP send limits (SMTP only)

Applied when `EMAIL_PROVIDER=smtp` and `OVAL_TEST_API` is not `1`:

| Env | Default | Meaning |
|-----|---------|---------|
| `EMAIL_OTP_MIN_INTERVAL_SEC` | `120` | Min gap between sends to the same email |
| `EMAIL_OTP_MAX_PER_EMAIL_PER_DAY` | `10` | Max sends per email per 24h |
| `EMAIL_OTP_MAX_SMTP_PER_HOUR` | `200` | Global cap per hour (emergency) |

When a limit triggers, the API still returns success but **no email is sent** (see warn logs `[email otp limit]`). Per-IP limits come from Better Auth (429).

### Rate limit storage

Better Auth rate limits run in **memory** per process unless a `rateLimit` table exists in the auth schema and `rateLimit.storage` is set to `database`. With multiple app replicas, enable DB storage after `pnpm run auth:generate` adds the model, or use a shared Redis secondary storage later.

### Trusted client IP

Behind a reverse proxy / Yandex ALB, set:

```bash
BETTER_AUTH_TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12
```

(comma-separated CIDRs or IPs). Without this, IP rate limits may collapse to one bucket.

## Local / Mailpit

Profile env already sets `SMTP_HOST=127.0.0.1`, `SMTP_PORT` from `MAILPIT_SMTP_HOST_PORT`. No `SMTP_USER` / `SMTP_PASS` required.

## Runbook (abuse / quota)

1. Check app logs for `[email otp limit]` and Postbox metrics in Yandex Cloud.
2. Temporarily lower `EMAIL_OTP_MAX_SMTP_PER_HOUR` or tighten Better Auth `rateLimit` in [`lib/auth/index.ts`](../../lib/auth/index.ts).
3. Phase 2: CAPTCHA on login, WAF on `/api/auth/*`.

See also [`testing.md`](testing.md) for recording mode in tests.
