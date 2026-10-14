CREATE TYPE "public"."social_publish_channel" AS ENUM('telegram');--> statement-breakpoint
CREATE TYPE "public"."social_publish_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "feed_post_social_publishes" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_post_id" text NOT NULL,
	"channel" "social_publish_channel" NOT NULL,
	"status" "social_publish_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"external_id" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_post_social_publishes" ADD CONSTRAINT "feed_post_social_publishes_feed_post_id_feed_posts_id_fk" FOREIGN KEY ("feed_post_id") REFERENCES "public"."feed_posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feed_post_social_publishes_post_channel_uidx" ON "feed_post_social_publishes" USING btree ("feed_post_id","channel");--> statement-breakpoint
CREATE INDEX "feed_post_social_publishes_status_idx" ON "feed_post_social_publishes" USING btree ("status");
