-- Запись — две независимые оси: участие (status: active | cancelled) и деньги (payment_state).
-- Миграции drizzle выполняются в одной транзакции, поэтому enum'ы, чьи новые значения нужны
-- в backfill, пересоздаются (ALTER TYPE ... ADD VALUE нельзя использовать в той же транзакции).
--
-- Маппинг старого status:
--   pending_payment          → active    + due
--   paid (цена 0)            → active    + free
--   paid (цена > 0)          → active    + paid
--   refunded                 → cancelled + refunded (cancelled_by по умолчанию admin)
--   transferred              → cancelled + moved    (cancelled_by = transferred)
--   cancelled                → cancelled + free (цена 0) / due («денег не было»)

CREATE TYPE "public"."registration_payment_state" AS ENUM('free', 'due', 'paid', 'refunded', 'moved');--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "payment_state" "registration_payment_state";--> statement-breakpoint

UPDATE "registrations" AS r
SET "payment_state" = (CASE
  WHEN r."status"::text = 'pending_payment' THEN 'due'
  WHEN r."status"::text = 'paid' AND s."price_cents" > 0 THEN 'paid'
  WHEN r."status"::text = 'paid' THEN 'free'
  WHEN r."status"::text = 'refunded' THEN 'refunded'
  WHEN r."status"::text = 'transferred' THEN 'moved'
  WHEN s."price_cents" > 0 THEN 'due'
  ELSE 'free'
END)::"registration_payment_state"
FROM "training_sessions" AS s
WHERE s."id" = r."training_session_id";--> statement-breakpoint

ALTER TYPE "public"."registration_cancel_source" RENAME TO "registration_cancel_source_old";--> statement-breakpoint
CREATE TYPE "public"."registration_cancel_source" AS ENUM('user', 'admin', 'session_cancelled', 'transferred');--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "cancelled_by" TYPE "public"."registration_cancel_source" USING "cancelled_by"::text::"public"."registration_cancel_source";--> statement-breakpoint
DROP TYPE "public"."registration_cancel_source_old";--> statement-breakpoint

UPDATE "registrations" SET "cancelled_by" = 'transferred' WHERE "status"::text = 'transferred';--> statement-breakpoint
UPDATE "registrations" SET "cancelled_by" = 'admin' WHERE "status"::text = 'refunded' AND "cancelled_by" IS NULL;--> statement-breakpoint

ALTER TYPE "public"."registration_status" RENAME TO "registration_status_old";--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "status" TYPE "public"."registration_status" USING (CASE
  WHEN "status"::text IN ('pending_payment', 'paid') THEN 'active'
  ELSE 'cancelled'
END)::"public"."registration_status";--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
DROP TYPE "public"."registration_status_old";--> statement-breakpoint

ALTER TABLE "registrations" ALTER COLUMN "payment_state" SET NOT NULL;
