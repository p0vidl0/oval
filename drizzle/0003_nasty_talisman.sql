ALTER TYPE "public"."feed_post_type" ADD VALUE 'race';--> statement-breakpoint
CREATE TABLE "post_images" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_posts" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "transferred_from_registration_id" text;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "registration_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "online_payment_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "gather_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD COLUMN "coach_name" text;--> statement-breakpoint
ALTER TABLE "post_images" ADD CONSTRAINT "post_images_post_id_feed_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feed_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_images_post_id_idx" ON "post_images" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_images_storage_key_idx" ON "post_images" USING btree ("storage_key");