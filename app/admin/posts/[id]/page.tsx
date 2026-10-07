import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBanner, PostStatusBadge } from "@/components/admin/admin-badges";
import { PublicationEditor } from "@/components/admin/publication-editor";
import { updatePublication } from "@/lib/admin/feed-actions";
import { isTelegramChannelPublishConfigured } from "@/lib/bots/telegram/channel-config";
import { listImagesForPost } from "@/lib/feed/post-images";
import { isPostLive, isPostScheduled } from "@/lib/feed/publication";
import { getFeedPostById, getTrainingSessionForPost } from "@/lib/feed/queries";
import { FEED_POST_TYPE_LABELS } from "@/lib/feed/types";
import {
  formatDateTimeRu,
  formatShortListDate,
  formatTimeHm,
} from "@/lib/format/datetime";
import { uploadPublicUrl } from "@/lib/uploads/storage";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
};

const DONE_MESSAGES: Record<string, string> = {
  created: "Публикация создана.",
  scheduled: "Публикация запланирована.",
  unscheduled: "Отложенная публикация отменена — запись стала черновиком.",
  saved: "Сохранено.",
  unpublished: "Снято с публикации.",
  published: "Опубликовано.",
};

export default async function AdminPostDetailPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { done, error } = await searchParams;
  const post = await getFeedPostById(id);
  if (!post) notFound();

  const training = await getTrainingSessionForPost(post);
  const images = await listImagesForPost(post.id);
  const now = new Date();

  return (
    <main>
      <Link
        href="/admin/posts"
        className="caption"
        style={{ color: "var(--ink-muted)" }}
      >
        ← Публикации
      </Link>
      <p
        className="caption"
        style={{
          color: "var(--ink-muted)",
          marginTop: "var(--space-4)",
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {FEED_POST_TYPE_LABELS[post.type]}
        <PostStatusBadge
          status={post.status}
          publishedAt={post.publishedAt}
          now={now}
        />
      </p>
      <h1
        className="nl-page-title nl-page-title--admin"
        style={{ marginTop: "var(--space-2)" }}
      >
        Редактирование
      </h1>
      <p className="caption" style={{ color: "var(--ink-muted)" }}>
        Создано {formatDateTimeRu(post.createdAt)}
        {post.publishedAt
          ? ` · ${isPostScheduled(post, now) ? "выйдет" : "опубликовано"} ${formatDateTimeRu(post.publishedAt)}`
          : null}
        {post.unpublishedAt
          ? ` · снято ${formatDateTimeRu(post.unpublishedAt)}`
          : null}
      </p>

      {error ? (
        <AdminBanner tone="error">{error}</AdminBanner>
      ) : done && DONE_MESSAGES[done] ? (
        <AdminBanner tone="ok">{DONE_MESSAGES[done]}</AdminBanner>
      ) : null}

      {training ? (
        <div className="nl-admin-callout nl-admin-callout--row">
          <p className="caption" style={{ margin: 0 }}>
            Тренировка «{training.title}» ·{" "}
            {formatShortListDate(training.startsAt)} ·{" "}
            {formatTimeHm(training.startsAt)}
            {training.status === "cancelled" ? " · отменена" : ""}. Дата, цена и
            лимит мест меняются в карточке тренировки.
          </p>
          <Link href={`/admin/sessions/${training.id}`} className="nl-button">
            Открыть тренировку
          </Link>
        </div>
      ) : null}

      <PublicationEditor
        action={updatePublication}
        mode={post.type === "training_announcement" ? "announcement" : "news"}
        post={{
          id: post.id,
          type: post.type,
          title: post.title,
          body: post.body,
          status: post.status,
          scheduledAt: isPostScheduled(post, now) ? post.publishedAt : null,
          pinned: post.pinned,
          publishToTelegram: post.publishToTelegram,
        }}
        training={post.type === "training_announcement" ? training : null}
        telegramChannelPublish={isTelegramChannelPublishConfigured()}
        existingImages={images.map((img) => ({
          id: img.id,
          src: uploadPublicUrl(img.storageKey),
          alt: img.alt,
        }))}
      />

      <div
        style={{
          marginTop: "var(--space-6)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          alignItems: "center",
        }}
      >
        {isPostLive(post, now) ? (
          <Link
            href={`/feed/${post.id}`}
            className="nl-button"
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть на сайте
          </Link>
        ) : null}
      </div>
    </main>
  );
}
