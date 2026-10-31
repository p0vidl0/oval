import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";
import { LoginNextPreview } from "@/app/login/login-next-preview";
import { TelegramLogin } from "@/app/login/telegram-login";
import { VkLogin } from "@/app/login/vk-login";
import { NlLogo } from "@/components/nl/logo";
import { isTelegramOidcConfigured } from "@/lib/auth/telegram/oidc-config";
import { isVkConfigured } from "@/lib/auth/vk/config";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const oidcConfigured = isTelegramOidcConfigured();
  const vkConfigured = isVkConfigured();

  return (
    <main className="nl-root nl-login-page">
      <section className="nl-login-cover">
        <Image
          src="/photos/login-bg.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="nl-login-cover__photo"
        />
        <div className="nl-login-cover__scrim" aria-hidden="true" />
        <div className="nl-login-cover__logo">
          <NlLogo showTitle={false} size={56} />
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
          style={{
            color: "var(--on-page-fg, var(--ink-2))",
            marginTop: "var(--space-2)",
          }}
        >
          По email, Telegram
          {vkConfigured ? " или VK" : ""} — для участников и администраторов
          клуба. Читать ленту можно и без входа.
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
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <Suspense fallback={null}>
            <TelegramLogin oidcConfigured={oidcConfigured} />
          </Suspense>
          {vkConfigured ? (
            <Suspense fallback={null}>
              <VkLogin />
            </Suspense>
          ) : null}
        </div>
        <Suspense fallback={null}>
          <LoginNextPreview next={params.next} />
        </Suspense>
      </section>
    </main>
  );
}
