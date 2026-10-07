CREATE TABLE "email_otp_send_log" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "email_otp_send_log_email_sent_at_idx" ON "email_otp_send_log" USING btree ("email","sent_at");--> statement-breakpoint
CREATE INDEX "email_otp_send_log_sent_at_idx" ON "email_otp_send_log" USING btree ("sent_at");