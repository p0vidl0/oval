/**
 * Seed published paid announcement for e2e. Run with oval-e2e DATABASE_URL.
 *   pnpm run task -- render-env oval-e2e && pnpm exec tsx tests/e2e/seed.ts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/lib/db/client";
import { feedPosts } from "@/lib/db/schema";
import { seedPublishedAnnouncement } from "../integration/helpers/seed";
import { E2E_POST_TITLE } from "./constants";

async function main() {
  const existing = await db
    .select()
    .from(feedPosts)
    .where(eq(feedPosts.title, E2E_POST_TITLE))
    .limit(1);
  if (existing[0]) {
    console.info("E2E seed already present:", existing[0].id);
    return;
  }
  const { postId } = await seedPublishedAnnouncement({
    priceCents: 150000,
    capacity: 20,
    title: E2E_POST_TITLE,
  });
  console.info("Seeded E2E post:", postId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
