"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

type YandexMetrikaNavigationProps = {
  counterId: string;
};

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

/** Доп. hit при client-side навигации (App Router). Первый просмотр — из init со ssr:true. */
export function YandexMetrikaNavigation({
  counterId,
}: YandexMetrikaNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipFirstHit = useRef(true);
  const previousHref = useRef("");

  useEffect(() => {
    const query = searchParams.toString();
    const href = `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;

    if (skipFirstHit.current) {
      skipFirstHit.current = false;
      previousHref.current = href;
      return;
    }

    if (previousHref.current === href) return;

    const ym = window.ym;
    const numericId = Number(counterId);
    if (!ym || Number.isNaN(numericId)) return;

    ym(numericId, "hit", href, {
      referer: previousHref.current || document.referrer,
      title: document.title,
    });
    previousHref.current = href;
  }, [pathname, searchParams, counterId]);

  return null;
}
