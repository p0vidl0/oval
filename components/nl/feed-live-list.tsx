"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeedCancelButton } from "@/components/nl/feed-cancel-button";
import { NlFeedPostCard } from "@/components/nl/feed-post-card";
import { FeedRegisterButton } from "@/components/nl/feed-register-button";
import {
  deriveCanRegister,
  type FeedLiveCard,
  liveCardToFeedCardProps,
} from "@/lib/feed/feed-live-card";
import type { FeedFilterKey } from "@/lib/feed/filter";
import { postMatchesFilter } from "@/lib/feed/filter";
import type { FeedRealtimeEvent } from "@/lib/realtime/feed-event-bus";
import { canUserCancelRegistration } from "@/lib/training/status";

type Props = {
  initialCards: FeedLiveCard[];
  filter: FeedFilterKey;
  isLoggedIn: boolean;
  /** У пользователя нет имени — перед записью спросить его. */
  needsName?: boolean;
};

function patchCardAfterRegister(
  card: FeedLiveCard,
  postId: string,
  registrationId: string,
  _needsOnlineCheckout: boolean,
): FeedLiveCard {
  if (card.postId !== postId || !card.training) return card;
  const training = card.training;
  const activeCount = training.activeCount + 1;
  const showPay = training.priceCents > 0 && training.onlinePaymentEnabled;
  const onsitePay = training.priceCents > 0 && !training.onlinePaymentEnabled;

  return {
    ...card,
    userBadge: "Вы записаны",
    userRegistration: {
      id: registrationId,
      // Бесплатная запись сразу считается оплаченной (как на сервере).
      status: training.priceCents > 0 ? "pending_payment" : "paid",
    },
    training: { ...training, activeCount },
    actions: {
      canRegister: false,
      payHref: showPay ? `/cabinet/pay/${registrationId}` : undefined,
      payLabel: card.actions.payLabel,
      externalHref: card.actions.externalHref,
      metaExtra: onsitePay ? "Оплата на месте" : undefined,
    },
  };
}

function patchCardAfterCancel(
  card: FeedLiveCard,
  postId: string,
): FeedLiveCard {
  if (card.postId !== postId || !card.training) return card;
  const activeCount = Math.max(0, card.training.activeCount - 1);
  const training = { ...card.training, activeCount };
  return {
    ...card,
    userBadge: undefined,
    userRegistration: null,
    training,
    actions: {
      ...card.actions,
      canRegister: deriveCanRegister(training, activeCount, false),
      payHref: undefined,
      metaExtra: undefined,
    },
  };
}

/** В БД закреплён только один пост; при merge нового pinned снимаем pin у остальных в state. */
function mergeFeedCard(
  prev: FeedLiveCard[],
  fresh: FeedLiveCard,
  insertIfMissing: boolean,
): FeedLiveCard[] {
  const idx = prev.findIndex((c) => c.postId === fresh.postId);
  let next: FeedLiveCard[];
  if (idx >= 0) {
    next = [...prev];
    next[idx] = fresh;
  } else if (insertIfMissing) {
    next = [fresh, ...prev];
  } else {
    return prev;
  }
  if (!fresh.pinned) return next;
  return next.map((c) =>
    c.postId === fresh.postId ? c : { ...c, pinned: false },
  );
}

function patchActiveCount(
  card: FeedLiveCard,
  sessionId: string,
  activeCount: number,
  isLoggedIn: boolean,
): FeedLiveCard {
  if (!card.training || card.training.sessionId !== sessionId) return card;
  const training = { ...card.training, activeCount };
  const canRegister =
    card.type === "training_announcement" &&
    !card.userRegistration &&
    deriveCanRegister(training, activeCount, false);

  return {
    ...card,
    training,
    actions: {
      ...card.actions,
      canRegister,
      registerHref:
        !isLoggedIn && canRegister
          ? `/login?next=/feed/${card.postId}`
          : undefined,
    },
  };
}

export function FeedLiveList({
  initialCards,
  filter,
  isLoggedIn,
  needsName = false,
}: Props) {
  const [cards, setCards] = useState(initialCards);

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const handleRegisterSuccess = useCallback(
    (postId: string, registrationId: string, needsPayment: boolean) => {
      setCards((prev) =>
        prev.map((c) =>
          patchCardAfterRegister(c, postId, registrationId, needsPayment),
        ),
      );
    },
    [],
  );

  const handleCancelSuccess = useCallback((postId: string) => {
    setCards((prev) => prev.map((c) => patchCardAfterCancel(c, postId)));
  }, []);

  const applyEvent = useCallback(
    async (event: FeedRealtimeEvent) => {
      if (event.type === "session.registrations_changed") {
        setCards((prev) =>
          prev.map((c) =>
            patchActiveCount(c, event.sessionId, event.activeCount, isLoggedIn),
          ),
        );
        return;
      }

      if (event.type === "feed.post_unpublished") {
        setCards((prev) => prev.filter((c) => c.postId !== event.postId));
        return;
      }

      if (
        event.type === "feed.post_published" ||
        event.type === "feed.post_updated"
      ) {
        const res = await fetch(`/api/feed/card/${event.postId}`);
        if (!res.ok) return;
        const fresh = (await res.json()) as FeedLiveCard;
        if (!postMatchesFilter(fresh.type, filter)) return;

        setCards((prev) =>
          mergeFeedCard(prev, fresh, event.type === "feed.post_published"),
        );
      }

      if (event.type === "session.changed") {
        let postIds: string[] = [];
        setCards((prev) => {
          postIds = prev
            .filter((c) => c.training?.sessionId === event.sessionId)
            .map((c) => c.postId);
          return prev;
        });
        for (const postId of postIds) {
          const res = await fetch(`/api/feed/card/${postId}`);
          if (!res.ok) continue;
          const fresh = (await res.json()) as FeedLiveCard;
          setCards((prev) => mergeFeedCard(prev, fresh, false));
        }
      }
    },
    [filter, isLoggedIn],
  );

  useEffect(() => {
    let es: EventSource | null = null;
    let retryMs = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      es = new EventSource("/api/feed/events");
      es.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as FeedRealtimeEvent;
          void applyEvent(event);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        es?.close();
        retryTimer = setTimeout(() => {
          retryMs = Math.min(retryMs * 2, 30_000);
          connect();
        }, retryMs);
      };
      es.onopen = () => {
        retryMs = 1000;
      };
    };

    connect();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [applyEvent]);

  const sorted = useMemo(() => {
    return [...cards].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    });
  }, [cards]);

  if (sorted.length === 0) {
    return (
      <p className="caption" style={{ color: "var(--ink-muted)" }}>
        Пока нет публикаций
      </p>
    );
  }

  return (
    <>
      {sorted.map((card) => {
        const props = liveCardToFeedCardProps(card);
        const showRegister =
          isLoggedIn && card.training && card.actions.canRegister;
        const reg = card.userRegistration;
        const showCancel =
          reg !== null &&
          card.training !== null &&
          new Date(card.training.startsAt) > new Date() &&
          canUserCancelRegistration(reg, card.training);

        return (
          <NlFeedPostCard
            key={card.postId}
            {...props}
            actions={{
              registerForm:
                showRegister && card.training ? (
                  <FeedRegisterButton
                    sessionId={card.training.sessionId}
                    postId={card.postId}
                    needsName={needsName}
                    onSuccess={({ registrationId, needsPayment }) =>
                      handleRegisterSuccess(
                        card.postId,
                        registrationId,
                        needsPayment,
                      )
                    }
                  />
                ) : undefined,
              registerHref:
                !isLoggedIn && card.actions.canRegister
                  ? card.actions.registerHref
                  : undefined,
              payHref: card.actions.payHref,
              payLabel: card.actions.payLabel,
              externalHref: card.actions.externalHref,
              trainingHref: card.actions.trainingHref,
              cancelForm:
                showCancel && reg ? (
                  <FeedCancelButton
                    registrationId={reg.id}
                    onSuccess={() => handleCancelSuccess(card.postId)}
                  />
                ) : undefined,
            }}
          />
        );
      })}
    </>
  );
}
