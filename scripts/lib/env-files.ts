import fs from "node:fs";
import path from "node:path";
import { dockerDir } from "./paths";

export type ComposeProject = "oval-dev" | "oval-integration" | "oval-e2e";

export function envFilePath(project: ComposeProject): string {
  return path.join(dockerDir, "env", `${project}.env`);
}

export function localEnvFilePath(project: ComposeProject): string {
  return path.join(dockerDir, "env", `${project}.local.env`);
}

export function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadProjectEnv(
  project: ComposeProject,
): Record<string, string> {
  const main = envFilePath(project);
  if (!fs.existsSync(main)) {
    throw new Error(
      `Missing ${main}. Run: pnpm run task -- render-env ${project}`,
    );
  }
  const merged = parseEnvFile(fs.readFileSync(main, "utf8"));
  const local = localEnvFilePath(project);
  if (fs.existsSync(local)) {
    Object.assign(merged, parseEnvFile(fs.readFileSync(local, "utf8")));
  }
  return merged;
}

export function applyEnvToProcess(env: Record<string, string>): void {
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }
}
