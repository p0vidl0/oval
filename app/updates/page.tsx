import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NlShell } from "@/components/nl/shell";
import { BackLink } from "@/components/nl/ui";
import { can } from "@/lib/auth/capabilities";
import { getServerSession } from "@/lib/auth/session";
import { pageDocumentTitle, siteName } from "@/lib/site/public-origin";
import { releasesForPublicUpdates } from "@/lib/site/releases";

export const metadata: Metadata = {
  title: { absolute: pageDocumentTitle("Обновления") },
  description: `Что нового на сайте ${siteName}.`,
  robots: { index: false, follow: false },
};

function formatReleaseDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export default async function UpdatesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login?next=/updates");
  const role = session.user.role as string | undefined;
  if (!can(role, "admin.access")) redirect("/");

  const visible = releasesForPublicUpdates();

  return (
    <NlShell tab="feed">
      <main className="nl-page nl-privacy" style={{ maxWidth: 720 }}>
        <BackLink href="/">На главную</BackLink>
        <h1
          className="nl-display"
          style={{ marginTop: "var(--space-4)", fontSize: 36 }}
        >
          Обновления
        </h1>
        <p
          className="body-sm"
          style={{
            color: "var(--on-page-fg, var(--ink-2))",
            marginTop: "var(--space-4)",
          }}
        >
          Кратко о том, что появилось на сайте. Подробности для разработчиков —
          в файле CHANGELOG в репозитории проекта.
        </p>

        {visible.map((release) => (
          <section
            key={release.version}
            className="nl-privacy__section"
            aria-labelledby={`release-${release.version}`}
          >
            <h2
              id={`release-${release.version}`}
              className="nl-privacy__heading"
            >
              {formatReleaseDate(release.date)}
              <span
                className="nl-updates__version nl-mono"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 400,
                  color: "var(--ink-muted)",
                  marginTop: "var(--space-1)",
                }}
              >
                v{release.version}
              </span>
            </h2>
            <ul className="nl-privacy__list body-sm">
              {release.publicNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </NlShell>
  );
}
