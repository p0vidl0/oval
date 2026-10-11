"use client";

import { useEffect } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client-track";
import { useTelegramMiniApp } from "@/lib/telegram/mini-app-context";

type Props = {
  registrationId: string;
  sessionId: string;
};

export function PaymentCheckoutTracker({ registrationId, sessionId }: Props) {
  const { isMiniApp } = useTelegramMiniApp();

  useEffect(() => {
    trackAnalyticsEvent("payment_checkout_view", {
      path: `/cabinet/pay/${registrationId}`,
      isMiniApp,
      props: { registrationId, sessionId },
    });
  }, [registrationId, sessionId, isMiniApp]);

  return null;
}
