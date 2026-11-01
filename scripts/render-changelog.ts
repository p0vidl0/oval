#!/usr/bin/env tsx
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { renderChangelogMarkdown } from "../lib/site/render-changelog";
import { repoRoot } from "./lib/paths";

const outPath = join(repoRoot, "CHANGELOG.md");
writeFileSync(outPath, renderChangelogMarkdown(), "utf8");
console.log(`Wrote ${outPath}`);
