ALTER TABLE "feed_posts" ADD COLUMN "slug" text;--> statement-breakpoint
WITH "dated" AS (
  SELECT
    "id",
    to_char(
      COALESCE("published_at", "created_at") AT TIME ZONE 'Asia/Omsk',
      'YYYY-MM-DD'
    ) AS "day",
    row_number() OVER (
      PARTITION BY to_char(
        COALESCE("published_at", "created_at") AT TIME ZONE 'Asia/Omsk',
        'YYYY-MM-DD'
      )
      ORDER BY COALESCE("published_at", "created_at"), "created_at", "id"
    ) AS "rn"
  FROM "feed_posts"
)
UPDATE "feed_posts" AS "p"
SET "slug" = CASE
  WHEN "d"."rn" = 1 THEN "d"."day"
  ELSE "d"."day" || '-' || "d"."rn"::text
END
FROM "dated" AS "d"
WHERE "p"."id" = "d"."id";--> statement-breakpoint
ALTER TABLE "feed_posts" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "feed_posts_slug_uidx" ON "feed_posts" USING btree ("slug");
