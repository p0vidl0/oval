-- Посещение — третья ось записи (unknown → attended / no_show / excused) и источник записи.
-- Новое значение registration_event_kind в этой миграции не используется, поэтому ADD VALUE.

CREATE TYPE "public"."registration_attendance" AS ENUM('unknown', 'attended', 'no_show', 'excused');--> statement-breakpoint
CREATE TYPE "public"."registration_source" AS ENUM('self', 'coach');--> statement-breakpoint
ALTER TYPE "public"."registration_event_kind" ADD VALUE 'attendance_marked';--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "attendance" "registration_attendance" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "attendance_marked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "attendance_marked_by" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "source" "registration_source" DEFAULT 'self' NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_attendance_marked_by_user_id_fk" FOREIGN KEY ("attendance_marked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;