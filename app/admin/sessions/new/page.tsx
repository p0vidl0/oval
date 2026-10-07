import Link from "next/link";
import { AdminBanner } from "@/components/admin/admin-badges";
import { PublicationEditor } from "@/components/admin/publication-editor";
import { createTrainingAction } from "@/lib/admin/session-actions";
import { isTelegramChannelPublishConfigured } from "@/lib/bots/telegram/channel-config";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function NewTrainingPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <main>
      <Link
        href="/admin/sessions"
        className="caption"
        style={{ color: "var(--ink-muted)" }}
      >
        ← Тренировки
      </Link>
      <h1
        className="nl-page-title nl-page-title--admin"
        style={{ marginTop: "var(--space-4)" }}
      >
        Новая тренировка
      </h1>
      {error ? <AdminBanner tone="error">{error}</AdminBanner> : null}
      <PublicationEditor
        action={createTrainingAction}
        mode="training"
        telegramChannelPublish={isTelegramChannelPublishConfigured()}
      />
    </main>
  );
}
