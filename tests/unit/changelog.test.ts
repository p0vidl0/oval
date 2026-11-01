import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appVersionLabel,
  footerBuildLabel,
  readPackageVersionFromDisk,
} from "@/lib/site/build-identity";
import { releases } from "@/lib/site/releases";
import { renderChangelogMarkdown } from "@/lib/site/render-changelog";

describe("changelog", () => {
  it("latest release version matches package.json", () => {
    expect(releases[0]?.version).toBe(readPackageVersionFromDisk());
  });

  it("CHANGELOG.md matches rendered output", () => {
    const onDisk = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
    expect(onDisk).toBe(renderChangelogMarkdown());
  });

  it("footer build label uses package version", () => {
    const prev = process.env.GIT_COMMIT;
    process.env.GIT_COMMIT = "abcdef0123456789";
    try {
      expect(appVersionLabel()).toBe(`v${readPackageVersionFromDisk()}`);
      expect(footerBuildLabel()).toBe(
        `v${readPackageVersionFromDisk()} - abcdef0`,
      );
    } finally {
      if (prev === undefined) delete process.env.GIT_COMMIT;
      else process.env.GIT_COMMIT = prev;
    }
  });

  it("releases are ordered newest first", () => {
    for (let i = 1; i < releases.length; i += 1) {
      const prev = releases[i - 1]?.date ?? "";
      const cur = releases[i]?.date ?? "";
      expect(prev >= cur).toBe(true);
    }
  });
});
