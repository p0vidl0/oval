CREATE TYPE "public"."registration_event_kind" AS ENUM('created', 'cancelled', 'payment_succeeded', 'refunded', 'transferred_out', 'transferred_in', 'released', 'merged');--> statement-breakpoint
CREATE TABLE "registration_events" (
	"id" text PRIMARY KEY NOT NULL,
	"registration_id" text NOT NULL,
	"session_id" text NOT NULL,
	"kind" "registration_event_kind" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_events_registration_idx" ON "registration_events" USING btree ("registration_id","created_at");--> statement-breakpoint
CREATE INDEX "registration_events_session_idx" ON "registration_events" USING btree ("session_id","created_at");