import {
  type ClientAnalyticsEventName,
  isClientAnalyticsEventName,
} from "@/lib/analytics/event-names";
import { normalizePath, normalizeReferrer } from "@/lib/analytics/referrer";
import { utmFromRecord } from "@/lib/analytics/utm";
import type { AnalyticsEventProps } from "@/lib/db/schema/app-schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CollectAnalyticsBody = {
  name: ClientAnalyticsEventName;
  visitorId: string;
  path: string;
  consent: true;
  referrer?: string | null;
  isMiniApp?: boolean;
  utm?: Record<string, unknown>;
  props?: AnalyticsEventProps;
};

export type ParseCollectResult =
  | { ok: true; data: CollectAnalyticsBody }
  | { ok: false; error: string };

function parseProps(raw: unknown): AnalyticsEventProps | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const props: AnalyticsEventProps = {};
  for (const key of [
    "postId",
    "sessionId",
    "registrationId",
    "paymentId",
    "authMethod",
  ] as const) {
    const v = o[key];
    if (typeof v === "string" && v.length <= 64) {
      props[key] = v;
    }
  }
  if (typeof o.amountCents === "number" && Number.isFinite(o.amountCents)) {
    props.amountCents = Math.round(o.amountCents);
  }
  return Object.keys(props).length > 0 ? props : undefined;
}

export function parseCollectAnalyticsBody(raw: unknown): ParseCollectResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "invalid body" };
  }
  const body = raw as Record<string, unknown>;

  if (body.consent !== true) {
    return { ok: false, error: "consent required" };
  }

  const name = body.name;
  if (typeof name !== "string" || !isClientAnalyticsEventName(name)) {
    return { ok: false, error: "invalid event name" };
  }

  const visitorId = body.visitorId;
  if (typeof visitorId !== "string" || !UUID_RE.test(visitorId)) {
    return { ok: false, error: "invalid visitor id" };
  }

  const path = normalizePath(typeof body.path === "string" ? body.path : "");
  if (!path) {
    return { ok: false, error: "invalid path" };
  }

  if (path.startsWith("/admin")) {
    return { ok: false, error: "admin paths not tracked" };
  }

  if (
    path.startsWith("/cabinet") &&
    name !== "payment_checkout_view" &&
    name !== "login_success"
  ) {
    return { ok: false, error: "cabinet page_view not tracked" };
  }

  const referrer =
    body.referrer === null || body.referrer === undefined
      ? null
      : normalizeReferrer(String(body.referrer));

  const isMiniApp =
    typeof body.isMiniApp === "boolean" ? body.isMiniApp : undefined;

  const utmRaw =
    body.utm && typeof body.utm === "object"
      ? (body.utm as Record<string, unknown>)
      : undefined;

  return {
    ok: true,
    data: {
      name,
      visitorId,
      path,
      consent: true,
      referrer,
      isMiniApp,
      utm: utmRaw,
      props: parseProps(body.props),
    },
  };
}

export function collectUtmFields(utm?: Record<string, unknown>) {
  const parsed = utmFromRecord(utm);
  return {
    utmSource: parsed.utmSource ?? null,
    utmMedium: parsed.utmMedium ?? null,
    utmCampaign: parsed.utmCampaign ?? null,
    utmContent: parsed.utmContent ?? null,
    utmTerm: parsed.utmTerm ?? null,
  };
}
