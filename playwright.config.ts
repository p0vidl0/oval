import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

const e2eEnv = path.join(__dirname, ".docker/env/oval-e2e.env");
dotenv.config({ path: e2eEnv });

const port = process.env.NEXT_DEV_HOST_PORT ?? "13001";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const useContainerApp = process.env.PLAYWRIGHT_NO_WEBSERVER === "1";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  ...(useContainerApp
    ? {}
    : {
        webServer: {
          command: `pnpm exec next dev -p ${port}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          env: {
            ...process.env,
            DATABASE_URL:
              process.env.DATABASE_URL ??
              `postgresql://oval:oval@localhost:15434/oval`,
            EMAIL_PROVIDER: "recording",
            OVAL_TEST_API: "1",
            PAYMENT_PROVIDER: "mock",
            PAYMENT_WEBHOOK_SECRET:
              process.env.PAYMENT_WEBHOOK_SECRET ?? "test-webhook-secret",
            BETTER_AUTH_SECRET:
              process.env.BETTER_AUTH_SECRET ??
              "e2e-test-auth-secret-min-32-chars-long",
            BETTER_AUTH_URL: baseURL,
          } as Record<string, string>,
        },
      }),
});
