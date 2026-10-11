import { isOvalAnalyticsEnabled } from "@/lib/analytics/config";
import { deviceClassFromUserAgent } from "@/lib/analytics/device-class";
import type { ServerAnalyticsEventName } from "@/lib/analytics/event-names";
import { normalizePath } from "@/lib/analytics/referrer";
import {
  type CollectAnalyticsBody,
  collectUtmFields,
} from "@/lib/analytics/schema";
import { db } from "@/lib/db/client";
import { type AnalyticsEventProps, analyticsEvents } from "@/lib/db/schema";

export type RecordServerEventInput = {
  name: ServerAnalyticsEventName;
  path?: string | null;
  props?: AnalyticsEventProps;
  userAgent?: string | null;
};

export async function recordClientEvent(
  data: CollectAnalyticsBody,
  userAgent: string | null,
): Promise<void> {
  if (!isOvalAnalyticsEnabled()) return;

  const utm = collectUtmFields(data.utm);

  await db.insert(analyticsEvents).values({
    id: crypto.randomUUID(),
    name: data.name,
    source: "client",
    visitorId: data.visitorId,
    path: data.path,
    referrer: data.referrer ?? null,
    ...utm,
    isMiniApp: data.isMiniApp ?? null,
    deviceClass: deviceClassFromUserAgent(userAgent),
    props: data.props ?? {},
  });
}

export async function recordServerEvent(
  input: RecordServerEventInput,
): Promise<void> {
  if (!isOvalAnalyticsEnabled()) return;

  const path = input.path ? normalizePath(input.path) : null;

  await db.insert(analyticsEvents).values({
    id: crypto.randomUUID(),
    name: input.name,
    source: "server",
    visitorId: null,
    path,
    referrer: null,
    isMiniApp: null,
    deviceClass: deviceClassFromUserAgent(input.userAgent),
    props: input.props ?? {},
  });
}
