import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import packageJson from "../../package.json";

const PACKAGE_VERSION = packageJson.version;

function shortSha(full: string): string {
  const trimmed = full.trim();
  if (!trimmed) return "unknown";
  return trimmed.slice(0, 7);
}

function gitHeadShort(): string | null {
  try {
    const out = execSync("git rev-parse --short=7 HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** Semver из package.json, с префиксом v для UI */
export function appVersionLabel(): string {
  return `v${PACKAGE_VERSION}`;
}

export function appVersion(): string {
  return PACKAGE_VERSION;
}

/** 7-символьный идентификатор сборки: GIT_COMMIT в Docker/CI, иначе git HEAD */
export function appCommitShort(): string {
  const fromEnv = process.env.GIT_COMMIT?.trim();
  if (fromEnv) return shortSha(fromEnv);
  return gitHeadShort() ?? "dev";
}

export function footerBuildLabel(): string {
  return `${appVersionLabel()} - ${appCommitShort()}`;
}

/** Для unit-тестов: package.json version без чтения env/git */
export function readPackageVersionFromDisk(): string {
  const raw = readFileSync(join(process.cwd(), "package.json"), "utf8");
  const parsed = JSON.parse(raw) as { version: string };
  return parsed.version;
}
