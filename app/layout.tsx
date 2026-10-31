import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { AnalyticsConsentBanner } from "@/components/analytics/analytics-consent-banner";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";
import { TelegramMiniAppProvider } from "@/components/telegram/telegram-mini-app-provider";
import { isOvalAnalyticsEnabled } from "@/lib/analytics/config";
import { analyticsConsentBootstrapScript } from "@/lib/analytics/consent";
import { AnalyticsConsentProvider } from "@/lib/analytics/consent-context";
import { getYandexMetrikaCounterId } from "@/lib/analytics/yandex-metrika";
import { fontVariables } from "@/lib/fonts";
import {
  getSiteMetadataBase,
  siteDefaultDescription,
  siteName,
} from "@/lib/site/public-origin";
import { telegramLaunchCaptureScript } from "@/lib/telegram/mini-app-launch";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteMetadataBase(),
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description: siteDefaultDescription,
  icons: {
    icon: [
      {
        url: "/icon.png",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-light.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
  openGraph: {
    siteName,
    locale: "ru_RU",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const yandexMetrikaCounterId = getYandexMetrikaCounterId();
  const ovalAnalyticsEnabled = isOvalAnalyticsEnabled();
  const showAnalyticsUi =
    ovalAnalyticsEnabled || yandexMetrikaCounterId !== null;

  return (
    <html
      lang="ru"
      className={`${fontVariables} h-full`}
      suppressHydrationWarning
    >
      <body className="nl-root flex min-h-full flex-col">
        {showAnalyticsUi ? (
          <script id="analytics-consent-bootstrap" blocking="render">
            {analyticsConsentBootstrapScript()}
          </script>
        ) : null}
        <AnalyticsConsentProvider>
          {showAnalyticsUi ? <AnalyticsConsentBanner /> : null}
          {showAnalyticsUi ? (
            <Suspense fallback={null}>
              <AnalyticsScripts
                yandexMetrikaCounterId={yandexMetrikaCounterId}
                ovalAnalyticsEnabled={ovalAnalyticsEnabled}
              />
            </Suspense>
          ) : null}
          <Script id="tg-launch-capture" strategy="beforeInteractive">
            {telegramLaunchCaptureScript()}
          </Script>
          <Suspense fallback={null}>
            <TelegramMiniAppProvider>{children}</TelegramMiniAppProvider>
          </Suspense>
        </AnalyticsConsentProvider>
      </body>
    </html>
  );
}
