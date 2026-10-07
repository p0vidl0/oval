import { beforeAll, beforeEach } from "vitest";
import { truncateAppTables } from "./truncate";

export function useIntegrationDb() {
  beforeAll(() => {
    if (process.env.OVAL_INTEGRATION !== "1") {
      throw new Error(
        "Set OVAL_INTEGRATION=1 (use pnpm run task -- test-integration)",
      );
    }
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required");
    }
  });

  beforeEach(async () => {
    await truncateAppTables();
  });
}
