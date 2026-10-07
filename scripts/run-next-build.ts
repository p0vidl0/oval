#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { envForHostBuild } from "./lib/host-build-env";
import { repoRoot } from "./lib/paths";

const result = spawnSync("next", ["build"], {
  cwd: repoRoot,
  env: { ...process.env, ...envForHostBuild() },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
