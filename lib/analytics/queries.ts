import { and, count, countDistinct, desc, eq, gte, sql } from "drizzle-orm";
import { resolveAnalyticsPathLabels } from "@/lib/analytics/path-labels";
import { db } from "@/lib/db/client";
import { analyticsEvents } from "@/lib/db/schema";

export const ANALYTICS_PERIOD_DAYS = [7, 30] as const;
export type AnalyticsPeriodDays = (typeof ANALYTICS_PERIOD_DAYS)[number];

function periodStart(days: AnalyticsPeriodDays): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function sinceCondition(days: AnalyticsPeriodDays) {
  return gte(analyticsEvents.occurredAt, periodStart(days));
}

export type AnalyticsOverview = {
  pageViews: number;
  uniqueVisitors: number;
  miniAppSharePercent: number | null;
};

export async function getAnalyticsOverview(
  days: AnalyticsPeriodDays,
): Promise<AnalyticsOverview> {
  const since = sinceCondition(days);

  const [pageViewsRow] = await db
    .select({ c: count() })
    .from(analyticsEvents)
    .where(and(since, eq(analyticsEvents.name, "page_view")));

  const [uniqueRow] = await db
    .select({ c: countDistinct(analyticsEvents.visitorId) })
    .from(analyticsEvents)
    .where(
      and(
        since,
        eq(analyticsEvents.source, "client"),
        sql`${analyticsEvents.visitorId} is not null`,
      ),
    );

  const [miniAppRow] = await db
    .select({ c: count() })
    .from(analyticsEvents)
    .where(
      and(
        since,
        eq(analyticsEvents.name, "page_view"),
        eq(analyticsEvents.isMiniApp, true),
      ),
    );

  const pageViews = pageViewsRow?.c ?? 0;
  const miniAppViews = miniAppRow?.c ?? 0;

  return {
    pageViews,
    uniqueVisitors: uniqueRow?.c ?? 0,
    miniAppSharePercent:
      pageViews > 0 ? Math.round((miniAppViews / pageViews) * 100) : null,
  };
}

export type TopPathRow = { path: string; views: number; label: string };

export async function getTopPaths(
  days: AnalyticsPeriodDays,
  limit = 15,
): Promise<TopPathRow[]> {
  const rows = await db
    .select({
      path: analyticsEvents.path,
      views: count(),
    })
    .from(analyticsEvents)
    .where(and(sinceCondition(days), eq(analyticsEvents.name, "page_view")))
    .groupBy(analyticsEvents.path)
    .orderBy(desc(count()))
    .limit(limit);

  const filtered = rows.filter((r): r is { path: string; views: number } =>
    Boolean(r.path),
  );
  const labels = await resolveAnalyticsPathLabels(filtered.map((r) => r.path));

  return filtered.map((r) => ({
    path: r.path,
    views: r.views,
    label: labels.get(r.path) ?? r.path,
  }));
}

export type UtmRow = {
  utmSource: string | null;
  utmCampaign: string | null;
  hits: number;
};

export async function getUtmBreakdown(
  days: AnalyticsPeriodDays,
  limit = 20,
): Promise<UtmRow[]> {
  const rows = await db
    .select({
      utmSource: analyticsEvents.utmSource,
      utmCampaign: analyticsEvents.utmCampaign,
      hits: count(),
    })
    .from(analyticsEvents)
    .where(
      and(
        sinceCondition(days),
        sql`(${analyticsEvents.utmSource} is not null or ${analyticsEvents.utmCampaign} is not null)`,
      ),
    )
    .groupBy(analyticsEvents.utmSource, analyticsEvents.utmCampaign)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((r) => ({
    utmSource: r.utmSource,
    utmCampaign: r.utmCampaign,
    hits: r.hits,
  }));
}

export type ReferrerRow = { referrer: string; hits: number };

export async function getTopReferrers(
  days: AnalyticsPeriodDays,
  limit = 15,
): Promise<ReferrerRow[]> {
  const rows = await db
    .select({
      referrer: analyticsEvents.referrer,
      hits: count(),
    })
    .from(analyticsEvents)
    .where(
      and(sinceCondition(days), sql`${analyticsEvents.referrer} is not null`),
    )
    .groupBy(analyticsEvents.referrer)
    .orderBy(desc(count()))
    .limit(limit);

  return rows
    .filter((r): r is ReferrerRow => Boolean(r.referrer))
    .map((r) => ({ referrer: r.referrer, hits: r.hits }));
}

export type FunnelStep = { name: string; label: string; count: number };

const FUNNEL_STEPS: { name: string; label: string }[] = [
  { name: "page_view_feed", label: "Лента (/feed)" },
  { name: "feed_post_view", label: "Просмотр поста" },
  { name: "register_click", label: "Клик «Записаться»" },
  { name: "registration_complete", label: "Запись создана" },
  { name: "payment_checkout_view", label: "Страница оплаты" },
  { name: "payment_success", label: "Оплата успешна" },
];

async function countEvent(
  days: AnalyticsPeriodDays,
  name: string,
  pathPrefix?: string,
): Promise<number> {
  const conditions = [sinceCondition(days), eq(analyticsEvents.name, name)];
  if (pathPrefix) {
    conditions.push(eq(analyticsEvents.path, pathPrefix));
  }
  const [row] = await db
    .select({ c: count() })
    .from(analyticsEvents)
    .where(and(...conditions));
  return row?.c ?? 0;
}

export async function getAnalyticsFunnel(
  days: AnalyticsPeriodDays,
): Promise<FunnelStep[]> {
  const feedViews = await db
    .select({ c: count() })
    .from(analyticsEvents)
    .where(
      and(
        sinceCondition(days),
        eq(analyticsEvents.name, "page_view"),
        sql`${analyticsEvents.path} in ('/', '/feed')`,
      ),
    );

  const counts: Record<string, number> = {
    page_view_feed: feedViews[0]?.c ?? 0,
    feed_post_view: await countEvent(days, "feed_post_view"),
    register_click: await countEvent(days, "register_click"),
    registration_complete: await countEvent(days, "registration_complete"),
    payment_checkout_view: await countEvent(days, "payment_checkout_view"),
    payment_success: await countEvent(days, "payment_success"),
  };

  return FUNNEL_STEPS.map((step) => ({
    name: step.name,
    label: step.label,
    count: counts[step.name] ?? 0,
  }));
}

export type LoginMethodRow = { authMethod: string; count: number };

export async function getLoginSuccessByMethod(
  days: AnalyticsPeriodDays,
): Promise<LoginMethodRow[]> {
  const rows = await db
    .select({
      authMethod: sql<string>`coalesce(${analyticsEvents.props}->>'authMethod', 'unknown')`,
      c: count(),
    })
    .from(analyticsEvents)
    .where(and(sinceCondition(days), eq(analyticsEvents.name, "login_success")))
    .groupBy(sql`coalesce(${analyticsEvents.props}->>'authMethod', 'unknown')`)
    .orderBy(desc(count()));

  return rows.map((r) => ({ authMethod: r.authMethod, count: r.c }));
}

export function parseAnalyticsPeriodDays(
  raw: string | undefined,
): AnalyticsPeriodDays {
  if (raw === "30") return 30;
  return 7;
}
