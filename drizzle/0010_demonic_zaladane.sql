CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"visitor_id" text,
	"path" text,
	"referrer" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"is_mini_app" boolean,
	"device_class" text DEFAULT 'unknown' NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE INDEX "analytics_events_occurred_at_idx" ON "analytics_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_name_occurred_at_idx" ON "analytics_events" USING btree ("name","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_path_occurred_at_idx" ON "analytics_events" USING btree ("path","occurred_at");