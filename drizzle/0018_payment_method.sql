-- Способ оплаты. Старые «Оплачено на месте» помечаются наличными: перевод тогда не различали.
-- Источник — metadata.source платежа или id доставки `admin:admin_onsite-…` от markRegistrationPaid.
CREATE TYPE "public"."payment_method" AS ENUM('online', 'cash', 'bank_transfer', 'moved');--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "method" "payment_method" DEFAULT 'online' NOT NULL;--> statement-breakpoint
UPDATE "payments" SET "method" = 'cash'
WHERE "metadata"->>'source' = 'admin_onsite'
   OR "id" IN (
     SELECT "payment_id" FROM "payment_webhook_deliveries"
     WHERE "payload"->>'source' = 'admin_onsite' AND "payment_id" IS NOT NULL
   );
