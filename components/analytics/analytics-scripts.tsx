"use client";

import { OvalAnalytics } from "@/components/analytics/oval-analytics";
import { YandexMetrika } from "@/components/analytics/yandex-metrika";
import { useAnalyticsConsent } from "@/lib/analytics/consent-context";

type AnalyticsScriptsProps = {
  yandexMetrikaCounterId: string | null;
  ovalAnalyticsEnabled: boolean;
};

export function AnalyticsScripts({
  yandexMetrikaCounterId,
  ovalAnalyticsEnabled,
}: AnalyticsScriptsProps) {
  const { analyticsAllowed } = useAnalyticsConsent();

  if (!analyticsAllowed) {
    return null;
  }

  return (
    <>
      {yandexMetrikaCounterId ? (
        <YandexMetrika counterId={yandexMetrikaCounterId} />
      ) : null}
      {ovalAnalyticsEnabled ? <OvalAnalytics /> : null}
    </>
  );
}
