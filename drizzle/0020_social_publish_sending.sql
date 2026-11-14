-- Claim перед вызовом Telegram. В этой миграции значение не используется, поэтому ADD VALUE.
ALTER TYPE "public"."social_publish_status" ADD VALUE 'sending';