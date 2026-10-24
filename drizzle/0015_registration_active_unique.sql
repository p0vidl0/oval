-- Одна активная запись на (user, session); отменённые и закрытые остаются в истории,
-- повторная запись создаёт новую строку.
DROP INDEX "registrations_user_session_active_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_user_session_active_uidx" ON "registrations" USING btree ("user_id","training_session_id") WHERE "registrations"."status" = 'active';
