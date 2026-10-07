import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBanner } from "@/components/admin/admin-badges";
import { PublicationEditor } from "@/components/admin/publication-editor";
import { createPublication } from "@/lib/admin/feed-actions";
import {
  getAnnouncementForSession,
  getTrainingSessionById,
} from "@/lib/feed/queries";

type Props = { searchParams: Promise<{ session?: string; error?: string }> };

/** Новость, либо анонс к существующей тренировке (`?session=`). */
export default async function NewPublicationPage({ searchParams }: Props) {
  const { session: sessionId, error } = await searchParams;
  const training = sessionId ? await getTrainingSessionById(sessionId) : null;
  if (sessionId && !training) notFound();
  const existing = training
    ? await getAnnouncementForSession(training.id)
    : null;

  return (
    <main>
      <Link
        href={training ? `/admin/sessions/${training.id}` : "/admin/posts"}
        className="caption"
        style={{ color: "var(--ink-muted)" }}
      >
        {training ? `← ${training.title}` : "← Публикации"}
      </Link>
      <h1
        className="nl-page-title nl-page-title--admin"
        style={{ marginTop: "var(--space-4)" }}
      >
        {training ? "Анонс тренировки" : "Новая новость"}
      </h1>
      {error ? <AdminBanner tone="error">{error}</AdminBanner> : null}
      {existing ? (
        <p className="caption">
          У тренировки уже есть анонс —{" "}
          <Link href={`/admin/posts/${existing.id}`}>открыть</Link>.
        </p>
      ) : (
        <PublicationEditor
          action={createPublication}
          mode={training ? "announcement" : "news"}
          training={training}
        />
      )}
      {!training ? (
        <p
          className="caption"
          style={{ color: "var(--ink-muted)", marginTop: "var(--space-4)" }}
        >
          Анонс тренировки создаётся вместе с тренировкой —{" "}
          <Link href="/admin/sessions/new">добавить тренировку</Link>. Перенос и
          отмена — из карточки тренировки.
        </p>
      ) : null}
    </main>
  );
}
