import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";
import { LoginNextPreview } from "@/app/login/login-next-preview";
import { TelegramLogin } from "@/app/login/telegram-login";
import { NlLogo } from "@/components/nl/logo";
import { isTelegramOidcConfigured } from "@/lib/auth/telegram/oidc-config";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const oidcConfigured = isTelegramOidcConfigured();

  return (
    <main className="nl-root nl-login-page">
      <section className="nl-login-cover">
        <img
          src="/photos/login-bg.jpg"
          alt=""
          className="nl-login-cover__photo"
        />
        <div className="nl-login-cover__scrim" aria-hidden="true" />
        <div className="nl-login-cover__logo">
          <NlLogo showTitle={false} href="/feed" size={56} />
        </div>
        <div className="nl-login-cover__foot">
          <h2 className="nl-display nl-login-cover__title">
            Вечерний трек ждёт
          </h2>
        </div>
      </section>
      <section className="nl-page nl-login-panel">
        <h1
          className="nl-display"
          style={{
            marginTop: "var(--space-6)",
            fontSize: 36,
            lineHeight: 0.98,
          }}
        >
          Вход
        </h1>
        <p
          className="body-sm"
          style={{ color: "var(--ink-2)", marginTop: "var(--space-2)" }}
        >
          По email или Telegram — для участников и администраторов клуба. Читать
          ленту можно и без входа.
        </p>
        <Suspense
          fallback={
            <p className="caption" style={{ color: "var(--ink-muted)" }}>
              Загрузка…
            </p>
          }
        >
          <LoginForm />
        </Suspense>
        <div
          style={{
            marginTop: "var(--space-6)",
            paddingTop: "var(--space-6)",
            borderTop: "1px solid var(--line)",
          }}
        >
          <h2
            className="caption"
            style={{ fontWeight: 700, marginBottom: "var(--space-3)" }}
          >
            Telegram
          </h2>
          <Suspense fallback={null}>
            <TelegramLogin oidcConfigured={oidcConfigured} />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <LoginNextPreview next={params.next} />
        </Suspense>
      </section>
    </main>
  );
}
