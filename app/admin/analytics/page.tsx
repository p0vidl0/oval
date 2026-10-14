import Link from "next/link";
import {
  getAnalyticsFunnel,
  getAnalyticsOverview,
  getLoginSuccessByMethod,
  getTopPaths,
  getTopReferrers,
  getUtmBreakdown,
  parseAnalyticsPeriodDays,
} from "@/lib/analytics/queries";

type Props = {
  searchParams: Promise<{ days?: string }>;
};

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const { days: daysRaw } = await searchParams;
  const days = parseAnalyticsPeriodDays(daysRaw);

  const [overview, topPaths, utm, referrers, funnel, loginMethods] =
    await Promise.all([
      getAnalyticsOverview(days),
      getTopPaths(days),
      getUtmBreakdown(days),
      getTopReferrers(days),
      getAnalyticsFunnel(days),
      getLoginSuccessByMethod(days),
    ]);

  return (
    <div className="nl-admin-analytics">
      <header className="nl-admin-analytics__header">
        <h1 className="nl-display" style={{ fontSize: 28, margin: 0 }}>
          Статистика
        </h1>
        <nav className="nl-admin-analytics__period" aria-label="Период">
          <Link
            href="/admin/analytics?days=7"
            aria-current={days === 7 ? "page" : undefined}
          >
            7 дней
          </Link>
          <Link
            href="/admin/analytics?days=30"
            aria-current={days === 30 ? "page" : undefined}
          >
            30 дней
          </Link>
        </nav>
      </header>

      <section className="nl-admin-analytics__cards">
        <div className="nl-admin-analytics__card">
          <span className="nl-label">Просмотры страниц</span>
          <strong className="nl-mono">{overview.pageViews}</strong>
        </div>
        <div className="nl-admin-analytics__card">
          <span className="nl-label">Уникальные посетители</span>
          <strong className="nl-mono">{overview.uniqueVisitors}</strong>
        </div>
        <div className="nl-admin-analytics__card">
          <span className="nl-label">Mini App (доля просмотров)</span>
          <strong className="nl-mono">
            {overview.miniAppSharePercent !== null
              ? `${overview.miniAppSharePercent}%`
              : "—"}
          </strong>
        </div>
      </section>

      <section className="nl-admin-analytics__section">
        <h2 className="nl-admin-analytics__heading">Воронка</h2>
        <table className="nl-admin-analytics__table">
          <thead>
            <tr>
              <th scope="col">Шаг</th>
              <th scope="col">Количество</th>
            </tr>
          </thead>
          <tbody>
            {funnel.map((step) => (
              <tr key={step.name}>
                <td>{step.label}</td>
                <td className="nl-mono">{step.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="nl-admin-analytics__section">
        <h2 className="nl-admin-analytics__heading">Популярные страницы</h2>
        <table className="nl-admin-analytics__table">
          <thead>
            <tr>
              <th scope="col">Страница</th>
              <th scope="col">Просмотры</th>
            </tr>
          </thead>
          <tbody>
            {topPaths.length === 0 ? (
              <tr>
                <td colSpan={2}>Нет данных</td>
              </tr>
            ) : (
              topPaths.map((row) => (
                <tr key={row.path}>
                  <td>
                    <Link href={row.path}>{row.label}</Link>
                    <div className="nl-admin-analytics__path nl-mono">
                      {row.path}
                    </div>
                  </td>
                  <td className="nl-mono">{row.views}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="nl-admin-analytics__section">
        <h2 className="nl-admin-analytics__heading">UTM</h2>
        <table className="nl-admin-analytics__table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Campaign</th>
              <th scope="col">События</th>
            </tr>
          </thead>
          <tbody>
            {utm.length === 0 ? (
              <tr>
                <td colSpan={3}>Нет UTM</td>
              </tr>
            ) : (
              utm.map((row, i) => (
                <tr key={`${row.utmSource}-${row.utmCampaign}-${i}`}>
                  <td>{row.utmSource ?? "—"}</td>
                  <td>{row.utmCampaign ?? "—"}</td>
                  <td className="nl-mono">{row.hits}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="nl-admin-analytics__section">
        <h2 className="nl-admin-analytics__heading">Referrer</h2>
        <table className="nl-admin-analytics__table">
          <thead>
            <tr>
              <th scope="col">Источник</th>
              <th scope="col">Переходы</th>
            </tr>
          </thead>
          <tbody>
            {referrers.length === 0 ? (
              <tr>
                <td colSpan={2}>Нет данных</td>
              </tr>
            ) : (
              referrers.map((row) => (
                <tr key={row.referrer}>
                  <td>{row.referrer}</td>
                  <td className="nl-mono">{row.hits}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="nl-admin-analytics__section">
        <h2 className="nl-admin-analytics__heading">Вход (login_success)</h2>
        <table className="nl-admin-analytics__table">
          <thead>
            <tr>
              <th scope="col">Способ</th>
              <th scope="col">Количество</th>
            </tr>
          </thead>
          <tbody>
            {loginMethods.length === 0 ? (
              <tr>
                <td colSpan={2}>Нет данных</td>
              </tr>
            ) : (
              loginMethods.map((row) => (
                <tr key={row.authMethod}>
                  <td>{row.authMethod}</td>
                  <td className="nl-mono">{row.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
