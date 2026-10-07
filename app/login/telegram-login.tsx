"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authErrorText } from "@/lib/auth/auth-error-text";
import { authClient } from "@/lib/auth/client";
import { useTelegramMiniApp } from "@/lib/telegram/mini-app-context";

type Props = {
  oidcConfigured: boolean;
};

export function TelegramLogin({ oidcConfigured }: Props) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/cabinet";
  const {
    isMiniApp,
    authPending,
    authError: miniAppAuthError,
  } = useTelegramMiniApp();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onOidcRedirect() {
    setError(null);
    setLoading(true);
    try {
      const res = await authClient.$fetch("/telegram/oidc/start", {
        method: "POST",
        body: { next },
      });
      if (res.error || !res.data) {
        setError(
          authErrorText(res.error, "Не удалось начать вход через Telegram"),
        );
        return;
      }
      const data = res.data as { authorizationUrl: string };
      window.location.assign(data.authorizationUrl);
    } finally {
      setLoading(false);
    }
  }

  if (isMiniApp) {
    return (
      <div className="nl-login-telegram" data-testid="telegram-login">
        <p className="caption" style={{ color: "var(--ink-2)" }}>
          {authPending
            ? "Вход через Telegram…"
            : "Вы в приложении Telegram — вход выполняется автоматически."}
        </p>
        {miniAppAuthError ? (
          <p className="nl-field-error" role="alert">
            {miniAppAuthError}
          </p>
        ) : null}
      </div>
    );
  }

  if (!oidcConfigured) {
    return (
      <p className="caption" style={{ color: "var(--ink-muted)" }}>
        Вход через Telegram временно недоступен.
      </p>
    );
  }

  return (
    <div className="nl-login-telegram" data-testid="telegram-login">
      <button
        type="button"
        className="nl-button nl-button--primary nl-button--block"
        disabled={loading}
        data-testid="telegram-oidc-login"
        onClick={() => void onOidcRedirect()}
      >
        {loading ? "…" : "Войти через Telegram"}
      </button>
      {error ? (
        <p className="nl-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
