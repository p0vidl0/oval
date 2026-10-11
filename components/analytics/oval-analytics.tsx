"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  persistUtmFromSearchParams,
  trackAnalyticsEvent,
} from "@/lib/analytics/client-track";
import { useTelegramMiniApp } from "@/lib/telegram/mini-app-context";

const FEED_POST_RE = /^\/feed\/([^/]+)$/;

export function OvalAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMiniApp } = useTelegramMiniApp();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    persistUtmFromSearchParams(searchParams);
  }, [searchParams]);

  useEffect(() => {
    const query = searchParams.toString();
    const pathOnly = pathname;
    const fullKey = query ? `${pathOnly}?${query}` : pathOnly;

    if (lastPath.current === fullKey) return;
    lastPath.current = fullKey;

    if (pathOnly.startsWith("/admin")) return;

    if (pathOnly.startsWith("/cabinet")) {
      return;
    }

    trackAnalyticsEvent("page_view", {
      path: pathOnly,
      isMiniApp,
    });

    const postMatch = FEED_POST_RE.exec(pathOnly);
    if (postMatch?.[1]) {
      trackAnalyticsEvent("feed_post_view", {
        path: pathOnly,
        isMiniApp,
        props: { postId: postMatch[1] },
      });
    }
  }, [pathname, searchParams, isMiniApp]);

  return null;
}
