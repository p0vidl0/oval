#!/usr/bin/env tsx
/**
 * Task runner (make-like) for oval — pnpm run task -- <command> [args]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { type ComposeFile, dockerCompose } from "./lib/compose";
import {
  applyEnvToProcess,
  type ComposeProject,
  loadProjectEnv,
} from "./lib/env-files";
import { dockerDir, repoRoot } from "./lib/paths";
import { renderProjectEnv } from "./lib/render-env";

const PROJECT_DEV: ComposeProject = "oval-dev";
const PROJECT_INTEGRATION: ComposeProject = "oval-integration";
const PROJECT_E2E: ComposeProject = "oval-e2e";

const HELP = `
oval task runner — pnpm run task -- <command>

  render-env [project]     Render .docker/env/<project>.env (default: oval-dev)
  infra-up [project]       Start Postgres (--wait)
  infra-down [project]     Stop stack (INFRA_DOWN_FLAGS=-v for volumes)
  dev-up                   Postgres + migrate + Next.js in Docker (-d)
  dev-down                 Stop oval-dev stack (app + Postgres)
  dev-restart              Recreate app container (pnpm install if lockfile changed)
  dev                      Same as dev-up (alias)
  db-migrate [project]     drizzle-kit migrate for project DATABASE_URL
  validate                 lint + build
  validate-full            validate + test:unit
  test-all                 test:unit + test-integration
  test-manual              validate + test-all + test-e2e
  test-integration         Isolated oval-integration stack + vitest integration
  e2e-up                   oval-e2e: Postgres + mailpit + migrate + app (-d)
  e2e-down                 Tear down oval-e2e
  test-e2e                 e2e-up + seed + Playwright (app in Docker)

Env: KEEP_INTEGRATION_STACK=1 keep integration stack after failure (success always tears down).
      KEEP_E2E_STACK=1     keep e2e stack after failure (success always tears down).
      E2E_SKIP_BUILD=1     skip docker rebuild of e2e app image.
`;

function runPnpmRun(script: string, env?: Record<string, string>): number {
  const result = spawnSync("pnpm", ["run", script], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  return result.status ?? 1;
}

function runPnpmExec(args: string[], env?: Record<string, string>): number {
  const result = spawnSync("pnpm", ["exec", ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  return result.status ?? 1;
}

function renderEnv(project: ComposeProject): number {
  try {
    const out = renderProjectEnv(project);
    console.log(`wrote ${out}`);
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    return 1;
  }
}

function resolveProject(
  arg: string | undefined,
  fallback: ComposeProject,
): ComposeProject {
  const name = (arg ?? fallback) as ComposeProject;
  const profile = path.join(dockerDir, "env/profiles", `${name}.env`);
  if (!fs.existsSync(profile)) {
    console.error(`Unknown project profile: ${name}`);
    process.exit(1);
  }
  return name;
}

const DEV_STACK: ComposeFile[] = ["compose.yaml"];
const E2E_STACK: ComposeFile[] = [
  "compose.infra.yaml",
  "compose.e2e-support.yaml",
  "compose.app.e2e.yaml",
];

function infraUp(project: ComposeProject): number {
  renderEnv(project);
  return dockerCompose(project, "compose.yaml", [
    "up",
    "-d",
    "--wait",
    "--wait-timeout",
    "120",
    "postgres",
  ]);
}

function infraDown(project: ComposeProject): number {
  renderEnv(project);
  const flags =
    process.env.INFRA_DOWN_FLAGS?.split(/\s+/).filter(Boolean) ?? [];
  return dockerCompose(project, "compose.yaml", ["down", ...flags]);
}

function dbMigrate(project: ComposeProject): number {
  renderEnv(project);
  const env = loadProjectEnv(project);
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL missing in compose env");
    return 1;
  }
  return runPnpmRun("db:migrate", { DATABASE_URL: env.DATABASE_URL });
}

function warnIfAuthSecretMissing(project: ComposeProject): void {
  const env = loadProjectEnv(project);
  if (!env.BETTER_AUTH_SECRET) {
    console.warn(
      "BETTER_AUTH_SECRET is unset — add .docker/env/oval-dev.local.env (see .local.env.example)",
    );
  }
}

function devUp(): number {
  if (renderEnv(PROJECT_DEV) !== 0) return 1;
  warnIfAuthSecretMissing(PROJECT_DEV);
  if (
    dockerCompose(PROJECT_DEV, DEV_STACK, [
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "120",
      "postgres",
    ]) !== 0
  ) {
    return 1;
  }
  if (dbMigrate(PROJECT_DEV) !== 0) return 1;
  const env = loadProjectEnv(PROJECT_DEV);
  if (
    dockerCompose(PROJECT_DEV, DEV_STACK, ["up", "-d", "--build", "app"]) !== 0
  ) {
    return 1;
  }
  console.log("");
  console.log("Oval dev stack is up (detached).");
  console.log(`  App:      ${env.BETTER_AUTH_URL}`);
  console.log(`  Postgres: localhost:${env.OVAL_PG_HOST_PORT}`);
  console.log(
    "  Logs:     COMPOSE_PROJECT_NAME=oval-dev docker compose -f .docker/compose.yaml --env-file .docker/env/oval-dev.env logs -f app",
  );
  console.log("");
  return 0;
}

function dev(): number {
  return devUp();
}

/** Recreate app so entrypoint re-runs (plain `docker restart` does not). */
function devRestart(): number {
  if (renderEnv(PROJECT_DEV) !== 0) return 1;
  if (dbMigrate(PROJECT_DEV) !== 0) return 1;
  if (
    dockerCompose(PROJECT_DEV, DEV_STACK, [
      "up",
      "-d",
      "--build",
      "--force-recreate",
      "app",
    ]) !== 0
  ) {
    return 1;
  }
  const env = loadProjectEnv(PROJECT_DEV);
  console.log(`App recreated: ${env.BETTER_AUTH_URL}`);
  return 0;
}

function integrationStackDown(): void {
  renderEnv(PROJECT_INTEGRATION);
  dockerCompose(PROJECT_INTEGRATION, "compose.test.yaml", ["down", "-v"]);
}

function integrationTeardownAfterRun(exitCode: number): void {
  const keepForDebug =
    exitCode !== 0 && process.env.KEEP_INTEGRATION_STACK === "1";
  if (keepForDebug) {
    console.log("KEEP_INTEGRATION_STACK=1: leaving oval-integration running");
    return;
  }
  console.log("Tearing down oval-integration...");
  integrationStackDown();
}

function testIntegration(): number {
  if (renderEnv(PROJECT_INTEGRATION) !== 0) return 1;
  dockerCompose(PROJECT_INTEGRATION, "compose.test.yaml", ["down", "-v"]);
  if (
    dockerCompose(PROJECT_INTEGRATION, "compose.test.yaml", [
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "120",
      "postgres",
    ]) !== 0
  ) {
    integrationTeardownAfterRun(1);
    return 1;
  }

  const env = loadProjectEnv(PROJECT_INTEGRATION);
  applyEnvToProcess(env);
  process.env.OVAL_INTEGRATION = "1";

  let exitCode = 0;
  try {
    if (dbMigrate(PROJECT_INTEGRATION) !== 0) {
      exitCode = 1;
      return exitCode;
    }
    exitCode = runPnpmRun("test:integration");
  } finally {
    integrationTeardownAfterRun(exitCode);
  }
  return exitCode;
}

function e2eEnsureInfra(): number {
  return dockerCompose(PROJECT_E2E, E2E_STACK, [
    "up",
    "-d",
    "--wait",
    "--wait-timeout",
    "120",
    "postgres",
    "mailpit",
  ]);
}

function e2eEnsureApp(): number {
  const subcommand = ["up", "-d", "--wait", "--wait-timeout", "300", "app"];
  if (process.env.E2E_SKIP_BUILD !== "1") {
    subcommand.splice(1, 0, "--build");
  }
  return dockerCompose(PROJECT_E2E, E2E_STACK, subcommand);
}

function e2eUp(): number {
  if (renderEnv(PROJECT_E2E) !== 0) return 1;
  applyEnvToProcess(loadProjectEnv(PROJECT_E2E));
  delete process.env.OVAL_INTEGRATION;
  if (e2eEnsureInfra() !== 0) return 1;
  if (dbMigrate(PROJECT_E2E) !== 0) return 1;
  if (e2eEnsureApp() !== 0) return 1;
  const env = loadProjectEnv(PROJECT_E2E);
  console.log("");
  console.log("Oval e2e stack is up (detached).");
  console.log(`  App:      ${env.PLAYWRIGHT_BASE_URL ?? env.BETTER_AUTH_URL}`);
  console.log(`  Postgres: localhost:${env.OVAL_PG_HOST_PORT}`);
  console.log(
    "  Logs:     COMPOSE_PROJECT_NAME=oval-e2e docker compose -f .docker/compose.infra.yaml -f .docker/compose.e2e-support.yaml -f .docker/compose.app.e2e.yaml --env-file .docker/env/oval-e2e.env logs -f app",
  );
  console.log("");
  return 0;
}

function e2eDown(): number {
  renderEnv(PROJECT_E2E);
  dockerCompose(PROJECT_E2E, E2E_STACK, ["down", "-v"]);
  return 0;
}

function e2eTeardownAfterRun(exitCode: number): void {
  const keepForDebug = exitCode !== 0 && process.env.KEEP_E2E_STACK === "1";
  if (keepForDebug) {
    console.log("KEEP_E2E_STACK=1: leaving oval-e2e running");
    return;
  }
  console.log("Tearing down oval-e2e...");
  e2eDown();
}

function validate(): number {
  if (runPnpmRun("lint") !== 0) return 1;
  return runPnpmRun("build");
}

function validateFull(): number {
  if (validate() !== 0) return 1;
  return runPnpmRun("test:unit");
}

function testAll(): number {
  if (runPnpmRun("test:unit") !== 0) return 1;
  return testIntegration();
}

function testManual(): number {
  if (validate() !== 0) return 1;
  if (testAll() !== 0) return 1;
  if (testE2e() !== 0) return 1;
  console.log("\nALL TESTS PASSED\n");
  return 0;
}

function logE2eStep(message: string): void {
  console.log(`\n[test-e2e] ${message}\n`);
}

function waitForHttpOk(url: string, timeoutMs = 60_000): boolean {
  const target = url.replace(/\/$/, "");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = spawnSync("curl", ["-sf", "-o", "/dev/null", target], {
      stdio: "ignore",
    });
    if (probe.status === 0) return true;
    spawnSync("sleep", ["1"]);
  }
  return false;
}

function testE2e(): number {
  let exitCode = 0;
  try {
    logE2eStep("Starting Docker (oval-e2e: Postgres, mailpit, app)…");
    if (e2eUp() !== 0) {
      exitCode = 1;
      return exitCode;
    }
    const env = loadProjectEnv(PROJECT_E2E);
    applyEnvToProcess(env);
    logE2eStep("Seeding feed post for Playwright…");
    if (
      runPnpmExec(
        ["tsx", "tests/e2e/seed.ts"],
        process.env as Record<string, string>,
      ) !== 0
    ) {
      exitCode = 1;
      return exitCode;
    }
    const baseUrl =
      env.PLAYWRIGHT_BASE_URL ??
      env.BETTER_AUTH_URL ??
      "http://localhost:13001";
    logE2eStep(`Checking app at ${baseUrl}…`);
    if (!waitForHttpOk(`${baseUrl}/feed`)) {
      console.error(`[test-e2e] App not reachable at ${baseUrl}/feed`);
      exitCode = 1;
      return exitCode;
    }
    logE2eStep(
      "Playwright on host (not in Docker). First run may download Chromium (~1–3 min), then ~5s for tests.",
    );
    if (process.env.PLAYWRIGHT_SKIP_BROWSER_INSTALL !== "1") {
      console.log("[test-e2e] playwright install chromium…");
      if (
        runPnpmExec(["playwright", "install", "chromium"], {
          ...process.env,
        } as Record<string, string>) !== 0
      ) {
        exitCode = 1;
        return exitCode;
      }
    }
    exitCode = runPnpmExec(["playwright", "test", "--reporter=line"], {
      ...process.env,
      PLAYWRIGHT_NO_WEBSERVER: "1",
      CI: "1",
    } as Record<string, string>);
    return exitCode;
  } finally {
    e2eTeardownAfterRun(exitCode);
  }
}

const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const [command, arg] = args;

function main(): number {
  if (command === undefined || command === "help" || command === "--help") {
    console.log(HELP.trim());
    return 0;
  }

  const handlers: Record<string, () => number> = {
    "render-env": () => renderEnv(resolveProject(arg, PROJECT_DEV)),
    "infra-up": () => infraUp(resolveProject(arg, PROJECT_DEV)),
    "infra-down": () => infraDown(resolveProject(arg, PROJECT_DEV)),
    "dev-up": () => devUp(),
    "dev-down": () => {
      renderEnv(PROJECT_DEV);
      return dockerCompose(PROJECT_DEV, DEV_STACK, ["down"]);
    },
    "dev-restart": () => devRestart(),
    dev: () => dev(),
    "db-migrate": () => dbMigrate(resolveProject(arg, PROJECT_DEV)),
    validate: () => validate(),
    "validate-full": () => validateFull(),
    "test-all": () => testAll(),
    "test-manual": () => testManual(),
    "test-integration": () => testIntegration(),
    "e2e-up": () => e2eUp(),
    "e2e-down": () => e2eDown(),
    "test-e2e": () => testE2e(),
  };

  const run = handlers[command];
  if (!run) {
    console.error(`Unknown command: ${command}\n`);
    console.log(HELP.trim());
    return 1;
  }
  return run();
}

process.exit(main());
