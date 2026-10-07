import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  type ComposeProject,
  envFilePath,
  loadProjectEnv,
  localEnvFilePath,
} from "./env-files";
import { dockerDir, repoRoot } from "./paths";

export type ComposeFile =
  | "compose.yaml"
  | "compose.infra.yaml"
  | "compose.test.yaml"
  | "compose.e2e-support.yaml"
  | "compose.app.dev.yaml"
  | "compose.app.e2e.yaml";

function buildComposeArgv(
  project: ComposeProject,
  composeFiles: ComposeFile[],
  options?: { extraEnvFiles?: string[] },
): string[] {
  const args = ["compose"];
  for (const file of composeFiles) {
    args.push("-f", path.join(dockerDir, file));
  }
  args.push("--env-file", envFilePath(project));
  const local = localEnvFilePath(project);
  if (fs.existsSync(local)) {
    args.push("--env-file", local);
  }
  for (const f of options?.extraEnvFiles ?? []) {
    args.push("--env-file", f);
  }
  return args;
}

export function dockerCompose(
  project: ComposeProject,
  composeFile: ComposeFile | ComposeFile[],
  composeSubcommand: string[],
  options?: { extraEnvFiles?: string[]; inheritEnv?: Record<string, string> },
): number {
  const files = Array.isArray(composeFile) ? composeFile : [composeFile];
  // Host env from a prior task (e.g. integration) must not override --env-file ports.
  const projectEnv = loadProjectEnv(project);
  const env = {
    ...process.env,
    ...projectEnv,
    COMPOSE_PROJECT_NAME: project,
    ...options?.inheritEnv,
  };
  const result = spawnSync(
    "docker",
    [...buildComposeArgv(project, files, options), ...composeSubcommand],
    {
      cwd: repoRoot,
      env,
      stdio: "inherit",
    },
  );
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}
