"use client";

import Link from "next/link";
import { useAnalyticsConsent } from "@/lib/analytics/consent-context";

export function AnalyticsConsentBanner() {
  const { consent, setConsent } = useAnalyticsConsent();

  if (consent !== "unknown") {
    return null;
  }

  return (
    <div
      className="nl-analytics-consent"
      role="dialog"
      aria-labelledby="analytics-consent-title"
      aria-describedby="analytics-consent-desc"
    >
      <div className="nl-analytics-consent__inner">
        <p
          id="analytics-consent-title"
          className="body-sm nl-analytics-consent__title"
        >
          Cookie и аналитика
        </p>
        <p
          id="analytics-consent-desc"
          className="caption nl-analytics-consent__desc"
        >
          Мы используем технически необходимые cookie для входа. С вашего
          согласия подключаем Яндекс.Метрику и собственную статистику посещений,
          чтобы улучшать сайт.{" "}
          <Link href="/privacy" className="nl-analytics-consent__link">
            Политика конфиденциальности
          </Link>
        </p>
        <div className="nl-analytics-consent__actions">
          <button
            type="button"
            className="nl-button nl-button--sm nl-button--primary"
            onClick={() => setConsent("granted")}
          >
            Согласен с аналитикой
          </button>
          <button
            type="button"
            className="nl-button nl-button--sm nl-button--ghost"
            onClick={() => setConsent("denied")}
          >
            Только необходимое
          </button>
        </div>
      </div>
    </div>
  );
}
