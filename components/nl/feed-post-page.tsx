import { CancelRegistrationForm } from "@/components/nl/cancel-registration-form";
import { NlFeedPostCard } from "@/components/nl/feed-post-card";
import { PostRegisterButton } from "@/components/nl/post-register-button";
import { NlShell } from "@/components/nl/shell";
import { NlStatus } from "@/components/nl/status";
import { TrainingRoster } from "@/components/nl/training-roster";
import { BackLink } from "@/components/nl/ui";
import { adminSessionHref, canManageSessionFromFeed } from "@/lib/admin/routes";
import { getServerSession } from "@/lib/auth/session";
import type { feedPosts } from "@/lib/db/schema";
import { describeRegistration } from "@/lib/domain/registration/describe";
import { PAID_CANCEL_MESSAGE } from "@/lib/domain/registration/types";
import { changePostUserNote } from "@/lib/feed/feed-live-card";
import { postPath } from "@/lib/feed/open-post-url";
import { listImagesForPost } from "@/lib/feed/post-images";
import {
  getLiveAnnouncementsBySession,
  getTrainingSessionForPost,
} from "@/lib/feed/queries";
import type { FeedPostMeta } from "@/lib/feed/types";
import {
  formatPriceRub,
  formatTimeHm,
  formatWeekdayInPhrase,
} from "@/lib/format/datetime";
import {
  isRegistrationOpen,
  REGISTRATION_BLOCK_MESSAGES,
} from "@/lib/training/registration-rules";
import {
  countActiveRegistrations,
  getUserRegistrationAnyStatus,
  getUserRegistrationForSession,
  listPublicRoster,
} from "@/lib/training/registrations";
import { uploadPublicUrl } from "@/lib/uploads/storage";

type PostRow = typeof feedPosts.$inferSelect;

type Props = {
  post: PostRow;
  searchParams: { error?: string; registered?: string };
};

export async function FeedPostPageView({ post, searchParams: query }: Props) {
  const publicPath = postPath(post.slug);
  const session = await getServerSession();
  const training = await getTrainingSessionForPost(post);
  const canManage = canManageSessionFromFeed(
    session?.user.role as string | undefined,
  );
  const images = await listImagesForPost(post.id);
  const gallery = images.map((img) => ({
    src: uploadPublicUrl(img.storageKey),
    alt: img.alt,
  }));
  const meta = (post.meta ?? {}) as FeedPostMeta;

  if (training && post.type === "training_announcement") {
    const activeCount = await countActiveRegistrations(training.id);
    const roster = await listPublicRoster(training.id);
    const showRosterSection = roster.length > 0 || training.registrationEnabled;
    const userReg = session
      ? await getUserRegistrationForSession(session.user.id, training.id)
      : null;
    const now = new Date();
    const view = userReg
      ? describeRegistration({
          registration: userReg,
          session: training,
          viewer: "participant",
          now,
        })
      : null;
    const gate = isRegistrationOpen({
      now,
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
          postSlug={post.slug}
          needsName={!session.user.name?.trim()}
        />
      ) : null;

    const cancelForm =
      userReg && view?.actions.cancel ? (
        <CancelRegistrationForm
          registrationId={userReg.id}
          returnTo={publicPath}
        />
      ) : null;

    const showPay = view?.actions.payOnline === true;

    return (
      <NlShell tab="feed">
        <main className="nl-page">
          <BackLink href="/feed">Лента</BackLink>
          <div className="nl-feed-layout nl-post-single">
            <div className="nl-feed-main">
              <NlFeedPostCard
                postId={post.id}
                postSlug={post.slug}
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
                      ? `/login?next=${encodeURIComponent(publicPath)}`
                      : undefined,
                  payHref:
                    showPay && userReg
                      ? `/cabinet/pay/${userReg.id}`
                      : undefined,
                  payLabel: `Оплатить · ${formatPriceRub(training.priceCents, training.currency)}`,
                  cancelForm,
                  manageHref: canManage
                    ? adminSessionHref(training.id)
                    : undefined,
                }}
              />
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
                <p className="caption">
                  {REGISTRATION_BLOCK_MESSAGES[gate.reason]}
                </p>
              ) : null}
              {showPay ? (
                <>
                  <p
                    className="caption"
                    style={{ color: "var(--on-page-fg, var(--ink-2))" }}
                  >
                    {formatPriceRub(training.priceCents, training.currency)} за
                    тренировку · оплатить можно позже
                  </p>
                  <p className="caption">
                    Место за вами. Оплатите до начала тренировки.
                  </p>
                </>
              ) : null}
              {userReg?.paymentState === "paid" ? (
                <NlStatus paid>
                  {`Оплачено. Ждём вас ${formatWeekdayInPhrase(training.startsAt)} в ${formatTimeHm(training.startsAt)}.`}
                </NlStatus>
              ) : null}
              {userReg?.paymentState === "free" ? (
                <NlStatus paid>Вы записаны.</NlStatus>
              ) : null}
              {userReg?.paymentState === "paid" ? (
                <p className="caption" style={{ color: "var(--ink-muted)" }}>
                  {PAID_CANCEL_MESSAGE}
                </p>
              ) : null}
              {view?.actions.payOnSite ? (
                <p className="caption">Оплата на месте.</p>
              ) : null}
              {showRosterSection ? (
                <TrainingRoster
                  entries={roster}
                  emptyMessage={
                    training.registrationEnabled
                      ? "Пока никто не записался"
                      : undefined
                  }
                />
              ) : null}
            </div>
            <aside className="nl-feed-aside" aria-hidden="true" />
          </div>
        </main>
      </NlShell>
    );
  }

  const announcement = training
    ? (await getLiveAnnouncementsBySession([training.id])).get(training.id)
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
        <BackLink href="/feed">Лента</BackLink>
        <div className="nl-feed-layout nl-post-single">
          <div className="nl-feed-main">
            <NlFeedPostCard
              postId={post.id}
              postSlug={post.slug}
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
                trainingHref: announcement
                  ? postPath(announcement.slug)
                  : undefined,
                manageHref:
                  canManage && training
                    ? adminSessionHref(training.id)
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
