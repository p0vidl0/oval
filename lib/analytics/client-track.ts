import {
  ANALYTICS_UTM_SESSION_KEY,
  readAnalyticsConsentFromStorage,
} from "@/lib/analytics/consent";
import type { ClientAnalyticsEventName } from "@/lib/analytics/event-names";
import { type UtmParams, utmFromSearchParams } from "@/lib/analytics/utm";
import { getOrCreateVisitorId } from "@/lib/analytics/visitor-id";
import type { AnalyticsEventProps } from "@/lib/db/schema/app-schema";

export type TrackEventOptions = {
  path?: string;
  referrer?: string | null;
  isMiniApp?: boolean;
  props?: AnalyticsEventProps;
};

function readStoredUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(ANALYTICS_UTM_SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UtmParams;
  } catch {
    return {};
  }
}

export function persistUtmFromSearchParams(params: URLSearchParams): void {
  const utm = utmFromSearchParams(params);
  if (!Object.values(utm).some(Boolean)) return;
  try {
    sessionStorage.setItem(ANALYTICS_UTM_SESSION_KEY, JSON.stringify(utm));
  } catch {
    // ignore
  }
}

const LOGIN_TRACKED_KEY = "oval_login_tracked";

export function trackAnalyticsEvent(
  name: ClientAnalyticsEventName,
  options: TrackEventOptions = {},
): void {
  if (readAnalyticsConsentFromStorage() !== "granted") {
    return;
  }

  if (name === "login_success") {
    try {
      if (sessionStorage.getItem(LOGIN_TRACKED_KEY)) return;
      sessionStorage.setItem(LOGIN_TRACKED_KEY, "1");
    } catch {
      // ignore
    }
  }

  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;

  const path = options.path ?? window.location.pathname;

  if (path.startsWith("/admin")) return;

  const body = {
    name,
    visitorId,
    path,
    consent: true as const,
    referrer: options.referrer ?? (document.referrer || null),
    isMiniApp: options.isMiniApp,
    utm: readStoredUtm(),
    props: options.props,
  };

  const payload = JSON.stringify(body);

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    const ok = navigator.sendBeacon("/api/analytics/collect", blob);
    if (ok) return;
  }

  void fetch("/api/analytics/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  });
}
