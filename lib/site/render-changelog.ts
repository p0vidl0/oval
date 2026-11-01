import { type ReleaseChangeSections, releases, unreleased } from "./releases";

const CHANGELOG_HEADER = `# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — [SemVer](https://semver.org/lang/ru/).

`;

function sectionLines(
  title: string,
  items: readonly string[] | undefined,
): string {
  if (!items?.length) return "";
  const body = items.map((line) => `- ${line}`).join("\n");
  return `\n### ${title}\n\n${body}\n`;
}

function renderChangeBlock(changes: ReleaseChangeSections): string {
  return (
    sectionLines("Добавлено", changes.added) +
    sectionLines("Изменено", changes.changed) +
    sectionLines("Исправлено", changes.fixed)
  );
}

export function renderChangelogMarkdown(): string {
  let out = CHANGELOG_HEADER;

  const unreleasedBody = renderChangeBlock(unreleased);
  out += "## [Unreleased]\n";
  if (unreleasedBody.trim()) {
    out += unreleasedBody;
  } else {
    out += "\n";
  }

  for (const release of releases) {
    out += `\n## [${release.version}] - ${release.date}\n`;
    out += renderChangeBlock(release);
  }

  return `${out.trimEnd()}\n`;
}
