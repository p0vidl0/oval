import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

/** Clears domain + test users between integration examples. */
export async function truncateAppTables() {
  await db.execute(sql`
    TRUNCATE TABLE
      analytics_events,
      payment_webhook_deliveries,
      training_session_events,
      registration_events,
      payments,
      post_images,
      feed_post_social_publishes,
      registrations,
      training_sessions,
      feed_posts,
      email_otp_send_log,
      user_merges,
      session,
      account,
      verification,
      "user"
    RESTART IDENTITY CASCADE
  `);
}
