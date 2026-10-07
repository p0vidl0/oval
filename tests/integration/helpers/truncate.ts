import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

/** Clears domain + test users between integration examples. */
export async function truncateAppTables() {
  await db.execute(sql`
    TRUNCATE TABLE
      payment_webhook_deliveries,
      training_session_events,
      payments,
      post_images,
      registrations,
      training_sessions,
      feed_posts,
      session,
      account,
      verification,
      "user"
    RESTART IDENTITY CASCADE
  `);
}
