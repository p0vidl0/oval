import type { feedPosts, trainingSessions } from "@/lib/db/schema";
import type { FeedPostMeta, FeedPostType } from "@/lib/feed/types";
import { formatPriceRub, formatTimeHm } from "@/lib/format/datetime";
import { isRegistrationOpen } from "@/lib/training/registration-rules";

type TrainingRow = typeof trainingSessions.$inferSelect;
type PostRow = typeof feedPosts.$inferSelect;

export type FeedLiveTraining = {
  sessionId: string;
  startsAt: string;
  endsAt: string | null;
  gatherAt: string | null;
  coachName: string | null;
  priceCents: number;
  currency: string;
  capacity: number | null;
  activeCount: number;
  registrationEnabled: boolean;
  onlinePaymentEnabled: boolean;
  status: "scheduled" | "cancelled";
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
};

export type FeedLiveCardActions = {
  canRegister: boolean;
  /** Карточки переноса/отмены → анонс тренировки. */
  trainingHref?: string;
  registerHref?: string;
  payHref?: string;
  payLabel?: string;
  externalHref?: string;
  metaExtra?: string;
};

export type FeedLiveCard = {
  postId: string;
  type: FeedPostType;
  title: string;
  body: string;
  publishedAt: string;
  pinned: boolean;
  eventDate: string | null;
  training: FeedLiveTraining | null;
  images: { src: string; alt: string }[];
  imageCount: number;
  timeChange?: { oldTime: string; newTime: string };
  userBadge?: string;
  /** Активная запись текущего пользователя на тренировку анонса. */
  userRegistration: FeedUserRegistration | null;
  linkTitle: boolean;
  actions: FeedLiveCardActions;
};

export type FeedUserRegistration = {
  id: string;
  status: "pending_payment" | "paid";
};

/** Пометка на карточке переноса/отмены для того, кто записан на тренировку. */
export function changePostUserNote(
  postType: FeedPostType,
  registration: {
    status: string;
    cancelledBy: string | null;
  } | null,
): string | undefined {
  if (!registration) return undefined;
  if (postType === "training_rescheduled") {
    return registration.status === "paid" ||
      registration.status === "pending_payment"
      ? "Ваша запись сохранена"
      : undefined;
  }
  if (postType !== "training_cancelled") return undefined;
  switch (registration.status) {
    case "paid":
      return "Вы оплатили — тренер оформит возврат или перенос";
    case "refunded":
      return "Возврат оформлен";
    case "transferred":
      return "Оплата перенесена на другую тренировку";
    case "cancelled":
      return registration.cancelledBy === "session_cancelled"
        ? "Ваша запись снята"
        : undefined;
    default:
      return undefined;
  }
}

export function formatTimeChangeFromMeta(
  postType: FeedPostType,
  meta: FeedPostMeta,
  trainingStartsAt: Date | undefined,
): { oldTime: string; newTime: string } | undefined {
  if (postType !== "training_rescheduled" || !meta.previousStartsAt) {
    return undefined;
  }
  return {
    oldTime: formatTimeHm(meta.previousStartsAt),
    newTime: formatTimeHm(
      meta.newStartsAt ?? trainingStartsAt ?? meta.previousStartsAt,
    ),
  };
}

export function buildFeedLiveCard(params: {
  post: PostRow;
  training: TrainingRow | null;
  activeCount: number;
  gallery: { src: string; alt: string }[];
  imageCount: number;
  timeChange?: { oldTime: string; newTime: string };
  eventDate: Date | null;
  isLoggedIn: boolean;
  userRegistration?: FeedUserRegistration | null;
  /** Анонс тренировки (для карточек переноса/отмены). */
  announcementPostId?: string | null;
  /** Пометка для записавшегося на карточке переноса/отмены. */
  userNote?: string;
}): FeedLiveCard {
  const { post, training, activeCount } = params;
  const meta = (post.meta ?? {}) as FeedPostMeta;
  // Записаться, оплатить и отменить можно только из анонса; перенос/отмена ведут на него.
  const isAnnouncement = post.type === "training_announcement";
  const userRegistration = isAnnouncement
    ? (params.userRegistration ?? null)
    : null;

  const gate =
    isAnnouncement && training && !userRegistration
      ? isRegistrationOpen({
          now: new Date(),
          sessionStatus: training.status,
          startsAt: training.startsAt,
          registrationEnabled: training.registrationEnabled,
          registrationOpensAt: training.registrationOpensAt,
          registrationClosesAt: training.registrationClosesAt,
          activeCount,
          capacity: training.capacity,
          userHasActiveRegistration: false,
        })
      : null;
  const canRegister = Boolean(gate?.open);

  const showPay =
    userRegistration?.status === "pending_payment" &&
    training &&
    training.priceCents > 0 &&
    training.onlinePaymentEnabled;
  const onsitePay =
    userRegistration?.status === "pending_payment" &&
    training &&
    training.priceCents > 0 &&
    !training.onlinePaymentEnabled;

  return {
    postId: post.id,
    type: post.type,
    title: post.title,
    body: post.body,
    publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
    pinned: post.pinned,
    eventDate: params.eventDate?.toISOString() ?? null,
    training: training
      ? {
          sessionId: training.id,
          startsAt: training.startsAt.toISOString(),
          endsAt: training.endsAt?.toISOString() ?? null,
          gatherAt: training.gatherAt?.toISOString() ?? null,
          coachName: training.coachName,
          priceCents: training.priceCents,
          currency: training.currency,
          capacity: training.capacity,
          activeCount,
          registrationEnabled: training.registrationEnabled,
          onlinePaymentEnabled: training.onlinePaymentEnabled,
          status: training.status,
          registrationOpensAt:
            training.registrationOpensAt?.toISOString() ?? null,
          registrationClosesAt:
            training.registrationClosesAt?.toISOString() ?? null,
        }
      : null,
    images: params.gallery,
    imageCount: params.imageCount,
    timeChange: params.timeChange,
    userBadge: isAnnouncement
      ? userRegistration
        ? "Вы записаны"
        : undefined
      : params.userNote,
    userRegistration,
    linkTitle: post.type !== "training_announcement",
    actions: {
      canRegister,
      trainingHref:
        !isAnnouncement && params.announcementPostId
          ? `/feed/${params.announcementPostId}`
          : undefined,
      registerHref:
        !params.isLoggedIn && training && canRegister
          ? `/login?next=/feed/${post.id}`
          : undefined,
      payHref: showPay ? `/cabinet/pay/${userRegistration?.id}` : undefined,
      payLabel: training
        ? `Оплатить · ${formatPriceRub(training.priceCents, training.currency)}`
        : "Оплатить",
      externalHref:
        post.type === "race" && meta.externalUrl ? meta.externalUrl : undefined,
      metaExtra: onsitePay ? "Оплата на месте" : undefined,
    },
  };
}

export function deriveCanRegister(
  training: FeedLiveTraining,
  activeCount: number,
  hasUserRegistration: boolean,
): boolean {
  if (hasUserRegistration) return false;
  const gate = isRegistrationOpen({
    now: new Date(),
    sessionStatus: training.status,
    startsAt: new Date(training.startsAt),
    registrationEnabled: training.registrationEnabled,
    registrationOpensAt: training.registrationOpensAt
      ? new Date(training.registrationOpensAt)
      : null,
    registrationClosesAt: training.registrationClosesAt
      ? new Date(training.registrationClosesAt)
      : null,
    activeCount,
    capacity: training.capacity,
    userHasActiveRegistration: false,
  });
  return gate.open;
}

export function liveCardToFeedCardProps(card: FeedLiveCard) {
  return {
    postId: card.postId,
    type: card.type,
    title: card.title,
    body: card.body,
    publishedAt: new Date(card.publishedAt),
    pinned: card.pinned,
    eventDate: card.eventDate ? new Date(card.eventDate) : null,
    training: card.training
      ? {
          startsAt: new Date(card.training.startsAt),
          endsAt: card.training.endsAt ? new Date(card.training.endsAt) : null,
          gatherAt: card.training.gatherAt
            ? new Date(card.training.gatherAt)
            : null,
          coachName: card.training.coachName,
          priceCents: card.training.priceCents,
          currency: card.training.currency,
          capacity: card.training.capacity,
          activeCount: card.training.activeCount,
          registrationEnabled: card.training.registrationEnabled,
          onlinePaymentEnabled: card.training.onlinePaymentEnabled,
          status: card.training.status,
        }
      : null,
    images: card.images,
    imageCount: card.imageCount,
    timeChange: card.timeChange,
    userBadge: card.userBadge,
    linkTitle: card.linkTitle,
    metaExtra: card.actions.metaExtra,
  };
}
