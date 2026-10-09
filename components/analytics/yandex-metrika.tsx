import Script from "next/script";
import { Suspense } from "react";
import { YandexMetrikaNavigation } from "@/components/analytics/yandex-metrika-navigation";
import {
  yandexMetrikaInitScript,
  yandexMetrikaWatchPixelUrl,
} from "@/lib/analytics/yandex-metrika";

type YandexMetrikaProps = {
  counterId: string;
};

export function YandexMetrika({ counterId }: YandexMetrikaProps) {
  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {yandexMetrikaInitScript(counterId)}
      </Script>
      <noscript>
        <div>
          {/* biome-ignore lint/performance/noImgElement: пиксель Метрики для noscript, не LCP */}
          <img
            src={yandexMetrikaWatchPixelUrl(counterId)}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
      <Suspense fallback={null}>
        <YandexMetrikaNavigation counterId={counterId} />
      </Suspense>
    </>
  );
}
