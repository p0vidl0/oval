export const CLIENT_ANALYTICS_EVENT_NAMES = [
  "page_view",
  "feed_post_view",
  "register_click",
  "payment_checkout_view",
  "login_success",
] as const;

export const SERVER_ANALYTICS_EVENT_NAMES = [
  "registration_complete",
  "payment_success",
] as const;

export type ClientAnalyticsEventName =
  (typeof CLIENT_ANALYTICS_EVENT_NAMES)[number];

export type ServerAnalyticsEventName =
  (typeof SERVER_ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsEventName =
  | ClientAnalyticsEventName
  | ServerAnalyticsEventName;

const CLIENT_SET = new Set<string>(CLIENT_ANALYTICS_EVENT_NAMES);
const SERVER_SET = new Set<string>(SERVER_ANALYTICS_EVENT_NAMES);

export function isClientAnalyticsEventName(
  name: string,
): name is ClientAnalyticsEventName {
  return CLIENT_SET.has(name);
}

export function isServerAnalyticsEventName(
  name: string,
): name is ServerAnalyticsEventName {
  return SERVER_SET.has(name);
}
