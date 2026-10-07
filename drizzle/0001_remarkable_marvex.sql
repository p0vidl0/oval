CREATE TYPE "public"."feed_post_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."feed_post_type" AS ENUM('training_announcement', 'training_cancelled', 'training_rescheduled', 'news');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('pending_payment', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."training_session_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TABLE "feed_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "feed_post_type" NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" "feed_post_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"author_user_id" text,
	"related_session_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"publish_to_telegram" boolean DEFAULT false NOT NULL,
	"publish_to_max" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"training_session_id" text NOT NULL,
	"status" "registration_status" DEFAULT 'pending_payment' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_post_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" text DEFAULT 'Велотрек' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"capacity" integer,
	"registration_opens_at" timestamp with time zone,
	"registration_closes_at" timestamp with time zone,
	"status" "training_session_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_sessions_feed_post_id_unique" UNIQUE("feed_post_id")
);
--> statement-breakpoint
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_training_session_id_training_sessions_id_fk" FOREIGN KEY ("training_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_feed_post_id_feed_posts_id_fk" FOREIGN KEY ("feed_post_id") REFERENCES "public"."feed_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_posts_status_published_at_idx" ON "feed_posts" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "feed_posts_type_idx" ON "feed_posts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "registrations_session_idx" ON "registrations" USING btree ("training_session_id");--> statement-breakpoint
CREATE INDEX "registrations_user_idx" ON "registrations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_user_session_active_uidx" ON "registrations" USING btree ("user_id","training_session_id");--> statement-breakpoint
CREATE INDEX "training_sessions_starts_at_idx" ON "training_sessions" USING btree ("starts_at");