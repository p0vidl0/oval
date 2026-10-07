-- Тренировка — самостоятельная сущность; доменные данные не удаляем (soft-delete / статусы).
-- Миграции drizzle выполняются в одной транзакции, поэтому enum'ы с новыми значениями,
-- которые используются в backfill, пересоздаются (ALTER TYPE ... ADD VALUE нельзя использовать в той же транзакции).

CREATE TYPE "public"."registration_cancel_source" AS ENUM('user', 'admin', 'session_cancelled');--> statement-breakpoint
CREATE TYPE "public"."training_session_event_kind" AS ENUM('created', 'updated', 'rescheduled', 'cancelled');--> statement-breakpoint

ALTER TYPE "public"."feed_post_status" RENAME TO "feed_post_status_old";--> statement-breakpoint
CREATE TYPE "public"."feed_post_status" AS ENUM('draft', 'published', 'unpublished');--> statement-breakpoint
ALTER TABLE "feed_posts" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "feed_posts" ALTER COLUMN "status" TYPE "public"."feed_post_status" USING "status"::text::"public"."feed_post_status";--> statement-breakpoint
ALTER TABLE "feed_posts" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
DROP TYPE "public"."feed_post_status_old";--> statement-breakpoint

ALTER TYPE "public"."registration_status" RENAME TO "registration_status_old";--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('pending_payment', 'paid', 'cancelled', 'refunded', 'transferred');--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "status" TYPE "public"."registration_status" USING "status"::text::"public"."registration_status";--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "status" SET DEFAULT 'pending_payment';--> statement-breakpoint
DROP TYPE "public"."registration_status_old";--> statement-breakpoint

CREATE TABLE "training_session_events" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"kind" "training_session_event_kind" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"post_id" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "training_sessions" DROP CONSTRAINT "training_sessions_feed_post_id_unique";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_registration_id_registrations_id_fk";--> statement-breakpoint
ALTER TABLE "post_images" DROP CONSTRAINT "post_images_post_id_feed_posts_id_fk";--> statement-breakpoint
ALTER TABLE "registrations" DROP CONSTRAINT "registrations_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "registrations" DROP CONSTRAINT "registrations_training_session_id_training_sessions_id_fk";--> statement-breakpoint
ALTER TABLE "training_sessions" DROP CONSTRAINT "training_sessions_feed_post_id_feed_posts_id_fk";--> statement-breakpoint
ALTER TABLE "training_sessions" ALTER COLUMN "feed_post_id" DROP NOT NULL;--> statement-breakpoint

ALTER TABLE "feed_posts" ADD COLUMN "unpublished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "post_images" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "cancelled_by" "registration_cancel_source";--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint

-- Backfill: название тренировки из анонса.
UPDATE "training_sessions" s SET "title" = p."title"
FROM "feed_posts" p WHERE p."id" = s."feed_post_id";--> statement-breakpoint
UPDATE "training_sessions" SET "title" = 'Тренировка' WHERE "title" IS NULL;--> statement-breakpoint
ALTER TABLE "training_sessions" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint

-- Backfill: анонс ссылается на тренировку через related_session_id; висячие ссылки обнуляем.
UPDATE "feed_posts" p SET "related_session_id" = s."id"
FROM "training_sessions" s
WHERE s."feed_post_id" = p."id" AND p."related_session_id" IS DISTINCT FROM s."id";--> statement-breakpoint
UPDATE "feed_posts" SET "related_session_id" = NULL
WHERE "related_session_id" IS NOT NULL
  AND "related_session_id" NOT IN (SELECT "id" FROM "training_sessions");--> statement-breakpoint

-- Backfill: время отмены тренировки — по посту об отмене.
UPDATE "training_sessions" s SET "cancelled_at" = COALESCE(
  (SELECT MIN(COALESCE(p."published_at", p."created_at")) FROM "feed_posts" p
   WHERE p."related_session_id" = s."id" AND p."type" = 'training_cancelled'),
  s."updated_at")
WHERE s."status" = 'cancelled';--> statement-breakpoint

-- Backfill: возвраты и переносы оплаты раньше записывались как cancelled.
UPDATE "registrations" r SET "status" = 'transferred'
WHERE r."status" = 'cancelled'
  AND EXISTS (SELECT 1 FROM "registrations" t WHERE t."transferred_from_registration_id" = r."id");--> statement-breakpoint
UPDATE "registrations" r SET "status" = 'refunded'
FROM "payments" p
WHERE p."registration_id" = r."id" AND r."status" = 'cancelled' AND p."metadata" ? 'refundedAt';--> statement-breakpoint

-- Backfill: журнал тренировки.
INSERT INTO "training_session_events" ("id", "session_id", "kind", "payload", "created_at")
SELECT gen_random_uuid()::text, s."id", 'created', '{}'::jsonb, s."created_at"
FROM "training_sessions" s;--> statement-breakpoint
INSERT INTO "training_session_events" ("id", "session_id", "kind", "payload", "post_id", "actor_user_id", "created_at")
SELECT gen_random_uuid()::text, p."related_session_id",
  CASE p."type" WHEN 'training_rescheduled' THEN 'rescheduled'::"training_session_event_kind"
                ELSE 'cancelled'::"training_session_event_kind" END,
  COALESCE(p."meta", '{}'::jsonb), p."id", p."author_user_id", p."created_at"
FROM "feed_posts" p
WHERE p."type" IN ('training_rescheduled', 'training_cancelled') AND p."related_session_id" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "training_session_events" ADD CONSTRAINT "training_session_events_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_events" ADD CONSTRAINT "training_session_events_post_id_feed_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feed_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_session_events" ADD CONSTRAINT "training_session_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "training_session_events_session_idx" ON "training_session_events" USING btree ("session_id","created_at");--> statement-breakpoint
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_related_session_id_training_sessions_id_fk" FOREIGN KEY ("related_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_post_id_feed_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feed_posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_training_session_id_training_sessions_id_fk" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_posts_related_session_idx" ON "feed_posts" USING btree ("related_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_posts_session_announcement_uidx" ON "feed_posts" USING btree ("related_session_id") WHERE "feed_posts"."type" = 'training_announcement';
