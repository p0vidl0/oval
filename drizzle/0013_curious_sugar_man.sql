CREATE TYPE "public"."user_merge_kind" AS ENUM('self_link', 'super_admin');--> statement-breakpoint
CREATE TABLE "user_merges" (
	"id" text PRIMARY KEY NOT NULL,
	"source_user_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"performed_by_user_id" text,
	"kind" "user_merge_kind" NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "merged_into_user_id" text;--> statement-breakpoint
ALTER TABLE "user_merges" ADD CONSTRAINT "user_merges_source_user_id_user_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_merges" ADD CONSTRAINT "user_merges_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_merges" ADD CONSTRAINT "user_merges_performed_by_user_id_user_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_merges_source_user_idx" ON "user_merges" USING btree ("source_user_id");--> statement-breakpoint
CREATE INDEX "user_merges_target_user_idx" ON "user_merges" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "user_merges_created_at_idx" ON "user_merges" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_uidx" ON "account" USING btree ("provider_id","account_id");
