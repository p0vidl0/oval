import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelRegistrationForm } from "@/components/nl/cancel-registration-form";
import { NlFeedPostCard } from "@/components/nl/feed-post-card";
import { PostRegisterButton } from "@/components/nl/post-register-button";
import { NlShell } from "@/components/nl/shell";
import { NlStatus } from "@/components/nl/status";
import { getServerSession } from "@/lib/auth/session";
import { changePostUserNote } from "@/lib/feed/feed-live-card";
import { listImagesForPost } from "@/lib/feed/post-images";
import {
  getLiveAnnouncementIdsBySession,
  getPublishedFeedPostById,
  getTrainingSessionForPost,
} from "@/lib/feed/queries";
import type { FeedPostMeta } from "@/lib/feed/types";
import {
  formatPriceRub,
  formatTimeHm,
  formatWeekdayInPhrase,
} from "@/lib/format/datetime";
import { metaDescriptionFromBody } from "@/lib/site/public-origin";
import {
  isRegistrationOpen,
  REGISTRATION_BLOCK_MESSAGES,
} from "@/lib/training/registration-rules";
import {
  countActiveRegistrations,
  getUserRegistrationAnyStatus,
  getUserRegistrationForSession,
} from "@/lib/training/registrations";
import {
  canUserCancelRegistration,
  PAID_CANCEL_MESSAGE,
} from "@/lib/training/status";
import { uploadPublicUrl } from "@/lib/uploads/storage";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; registered?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublishedFeedPostById(id);
  if (!post) {
    return { title: "Не найдено" };
  }

  const description = metaDescriptionFromBody(post.body);
  const images = await listImagesForPost(post.id);
  const cover = images[0];
  const coverUrl = cover ? uploadPublicUrl(cover.storageKey) : undefined;
  const publishedTime = (post.publishedAt ?? post.createdAt).toISOString();

  return {
    title: post.title,
    description,
    alternates: { canonical: `/feed/${post.id}` },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      publishedTime,
      url: `/feed/${post.id}`,
      ...(coverUrl
        ? {
            images: [
              {
                url: coverUrl,
                alt: cover.alt.trim() || post.title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: coverUrl ? "summary_large_image" : "summary",
      title: post.title,
      description,
      ...(coverUrl ? { images: [coverUrl] } : {}),
    },
  };
}

export default async function FeedPostPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const post = await getPublishedFeedPostById(id);
  if (!post) notFound();

  const session = await getServerSession();
  const training = await getTrainingSessionForPost(post);
  const images = await listImagesForPost(post.id);
  const gallery = images.map((img) => ({
    src: uploadPublicUrl(img.storageKey),
    alt: img.alt,
  }));
  const meta = (post.meta ?? {}) as FeedPostMeta;

  let cardExtra: React.ReactNode = null;
  if (training && post.type === "training_announcement") {
    const activeCount = await countActiveRegistrations(training.id);
    const userReg = session
      ? await getUserRegistrationForSession(session.user.id, training.id)
      : null;
    const gate = isRegistrationOpen({
      now: new Date(),
      sessionStatus: training.status,
      startsAt: training.startsAt,
      registrationEnabled: training.registrationEnabled,
      registrationOpensAt: training.registrationOpensAt,
      registrationClosesAt: training.registrationClosesAt,
      activeCount,
      capacity: training.capacity,
      userHasActiveRegistration: userReg !== null,
    });

    const registerForm =
      gate.open && session ? (
        <PostRegisterButton
          sessionId={training.id}
          postId={post.id}
          needsName={!session.user.name?.trim()}
        />
      ) : null;

    const canCancel =
      userReg !== null &&
      training.startsAt > new Date() &&
      canUserCancelRegistration(userReg, training);
    const cancelForm = canCancel ? (
      <CancelRegistrationForm
        registrationId={userReg.id}
        returnTo={`/feed/${post.id}`}
      />
    ) : null;

    const showPay =
      userReg?.status === "pending_payment" &&
      training.priceCents > 0 &&
      training.onlinePaymentEnabled;

    cardExtra = (
      <>
        {query.registered === "1" ? (
          <p className="caption" style={{ color: "var(--signal)" }}>
            Вы записаны.
          </p>
        ) : null}
        {query.error ? (
          <p className="caption" style={{ color: "var(--cancel)" }}>
            {query.error}
          </p>
        ) : null}
        {training.coachName ? (
          <p className="caption" style={{ color: "var(--ink-muted)" }}>
            тренер — {training.coachName}
          </p>
        ) : null}
        {!userReg && !gate.open ? (
          <p className="caption">{REGISTRATION_BLOCK_MESSAGES[gate.reason]}</p>
        ) : null}
        {userReg?.status === "pending_payment" &&
        training.priceCents > 0 &&
        training.onlinePaymentEnabled ? (
          <>
            <p className="caption" style={{ color: "var(--ink-2)" }}>
              {formatPriceRub(training.priceCents, training.currency)} за
              тренировку · оплатить можно позже
            </p>
            <p className="caption">
              Место за вами. Оплатите до начала тренировки.
            </p>
          </>
        ) : null}
        {userReg?.status === "paid" ? (
          <NlStatus paid>
            {training.priceCents > 0
              ? `Оплачено. Ждём вас ${formatWeekdayInPhrase(training.startsAt)} в ${formatTimeHm(training.startsAt)}.`
              : "Вы записаны."}
          </NlStatus>
        ) : null}
        {userReg && !canUserCancelRegistration(userReg, training) ? (
          <p className="caption" style={{ color: "var(--ink-muted)" }}>
            {PAID_CANCEL_MESSAGE}
          </p>
        ) : null}
        {userReg?.status === "pending_payment" &&
        training.priceCents > 0 &&
        !training.onlinePaymentEnabled ? (
          <p className="caption">Оплата на месте.</p>
        ) : null}
      </>
    );

    return (
      <NlShell tab="feed">
        <main className="nl-page">
          <Link
            href="/feed"
            className="caption"
            style={{ color: "var(--ink-muted)" }}
          >
            ← Лента
          </Link>
          <div className="nl-feed-layout nl-post-single">
            <div className="nl-feed-main">
              <NlFeedPostCard
                postId={post.id}
                type={post.type}
                title={post.title}
                body={post.body}
                publishedAt={post.publishedAt ?? post.createdAt}
                pinned={post.pinned}
                training={{
                  startsAt: training.startsAt,
                  endsAt: training.endsAt,
                  gatherAt: training.gatherAt,
                  coachName: training.coachName,
                  priceCents: training.priceCents,
                  currency: training.currency,
                  capacity: training.capacity,
                  activeCount,
                  registrationEnabled: training.registrationEnabled,
                  onlinePaymentEnabled: training.onlinePaymentEnabled,
                  status: training.status,
                }}
                images={gallery}
                imageCount={images.length}
                linkTitle={false}
                userBadge={userReg ? "Вы записаны" : undefined}
                actions={{
                  registerForm,
                  registerHref:
                    gate.open && !session
                      ? `/login?next=/feed/${post.id}`
                      : undefined,
                  payHref: showPay ? `/cabinet/pay/${userReg.id}` : undefined,
                  payLabel: `Оплатить · ${formatPriceRub(training.priceCents, training.currency)}`,
                  cancelForm,
                }}
              />
              {cardExtra}
            </div>
            {/* Пустая колонка — карточка той же ширины, что в ленте. */}
            <aside className="nl-feed-aside" aria-hidden="true" />
          </div>
        </main>
      </NlShell>
    );
  }

  // Перенос/отмена: ссылка на анонс и пометка для записавшегося.
  const announcementId = training
    ? (await getLiveAnnouncementIdsBySession([training.id])).get(training.id)
    : undefined;
  const userNote =
    session && training
      ? changePostUserNote(
          post.type,
          await getUserRegistrationAnyStatus(session.user.id, training.id),
        )
      : undefined;

  const eventDate =
    post.type === "race" && meta.eventStartsAt
      ? new Date(meta.eventStartsAt)
      : null;
  let timeChange: { oldTime: string; newTime: string } | undefined;
  if (post.type === "training_rescheduled" && meta.previousStartsAt) {
    timeChange = {
      oldTime: formatTimeHm(meta.previousStartsAt),
      newTime: formatTimeHm(meta.newStartsAt ?? meta.previousStartsAt),
    };
  }

  return (
    <NlShell tab="feed">
      <main className="nl-page">
        <Link
          href="/feed"
          className="caption"
          style={{ color: "var(--ink-muted)" }}
        >
          ← Лента
        </Link>
        <div className="nl-feed-layout nl-post-single">
          <div className="nl-feed-main">
            <NlFeedPostCard
              postId={post.id}
              type={post.type}
              title={post.title}
              body={post.body}
              publishedAt={post.publishedAt ?? post.createdAt}
              pinned={post.pinned}
              eventDate={eventDate}
              images={gallery}
              imageCount={images.length}
              timeChange={timeChange}
              userBadge={userNote}
              linkTitle={false}
              actions={{
                externalHref:
                  post.type === "race" ? meta.externalUrl : undefined,
                trainingHref: announcementId
                  ? `/feed/${announcementId}`
                  : undefined,
              }}
            />
          </div>
          <aside className="nl-feed-aside" aria-hidden="true" />
        </div>
      </main>
    </NlShell>
  );
}
