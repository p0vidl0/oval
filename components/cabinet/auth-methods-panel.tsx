"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authErrorText } from "@/lib/auth/auth-error-text";
import { authClient } from "@/lib/auth/client";
import type { LinkedAuthMethod } from "@/lib/auth/linked-accounts";
import type { AuthProviderId } from "@/lib/auth/providers";
import { addProviderButtonLabel, providerLabel } from "@/lib/auth/providers";
import {
  confirmAuthMethodMerge,
  sendAuthLinkEmailOtp,
  startAuthMethodLink,
  unlinkAuthMethodAction,
  verifyAuthLinkEmailOtp,
} from "@/lib/cabinet/auth-methods-actions";

type Props = {
  linked: LinkedAuthMethod[];
  available: AuthProviderId[];
  mergeLinkToken: string | null;
  linkNotice: string | null;
  telegramOidcConfigured: boolean;
  telegramBotConfigured: boolean;
};

export function AuthMethodsPanel({
  linked,
  available: initialAvailable,
  mergeLinkToken,
  linkNotice,
  telegramOidcConfigured,
  telegramBotConfigured,
}: Props) {
  const router = useRouter();
  const available = initialAvailable;
  const [error, setError] = useState<string | null>(linkNotice);
  const [adding, setAdding] = useState<AuthProviderId | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [otp, setOtp] = useState("");
  const [emailStep, setEmailStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [mergeToken, setMergeToken] = useState(mergeLinkToken);
  const [botDeepLink, setBotDeepLink] = useState<string | null>(null);

  async function onUnlink(method: LinkedAuthMethod) {
    const label = providerLabel(method.providerId);
    const detail = method.detail?.trim();
    const message =
      `Отключить вход через ${label}?` +
      (detail ? `\n${detail}` : "") +
      "\n\nВы больше не сможете войти этим способом.";
    if (!window.confirm(message)) {
      return;
    }

    setError(null);
    setLoading(true);
    const result = await unlinkAuthMethodAction(method.providerId);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  async function onPickProvider(providerId: AuthProviderId) {
    setError(null);
    setLoading(true);
    const started = await startAuthMethodLink(providerId);
    setLoading(false);
    if (!started.ok) {
      setError(started.message);
      return;
    }
    setLinkToken(started.linkToken);
    setAdding(providerId);

    if (providerId === "email") {
      setEmailStep("email");
      return;
    }
    if (providerId === "vk") {
      setLoading(true);
      try {
        const res = await authClient.$fetch("/vk/oauth/start", {
          method: "POST",
          body: { linkToken: started.linkToken, next: "/cabinet" },
        });
        if (res.error || !res.data) {
          setError(authErrorText(res.error, "Не удалось начать VK"));
          return;
        }
        const data = res.data as { authorizationUrl: string };
        window.location.assign(data.authorizationUrl);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (providerId === "telegram") {
      if (telegramOidcConfigured) {
        setLoading(true);
        try {
          const res = await authClient.$fetch("/telegram/oidc/start", {
            method: "POST",
            body: { linkToken: started.linkToken, next: "/cabinet" },
          });
          if (res.error || !res.data) {
            setError(authErrorText(res.error, "Не удалось начать Telegram"));
            return;
          }
          const data = res.data as { authorizationUrl: string };
          window.location.assign(data.authorizationUrl);
        } finally {
          setLoading(false);
        }
        return;
      }
      if (telegramBotConfigured) {
        setLoading(true);
        try {
          const res = await authClient.$fetch("/telegram/login-intent", {
            method: "POST",
            body: { linkToken: started.linkToken },
          });
          if (res.error || !res.data) {
            setError(authErrorText(res.error, "Не удалось создать ссылку"));
            return;
          }
          const data = res.data as { deepLink: string; token: string };
          setBotDeepLink(data.deepLink);
          const poll = window.setInterval(async () => {
            const exchange = await authClient.$fetch("/sign-in/telegram/bot", {
              method: "POST",
              body: { token: data.token },
            });
            if (exchange.error) return;
            const payload = exchange.data as { redirect?: string };
            window.clearInterval(poll);
            if (payload.redirect) {
              window.location.assign(payload.redirect);
            } else {
              router.refresh();
            }
          }, 2500);
          window.setTimeout(() => window.clearInterval(poll), 120_000);
        } finally {
          setLoading(false);
        }
      }
    }
  }

  async function onSendEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!linkToken) return;
    setLoading(true);
    const result = await sendAuthLinkEmailOtp(linkToken, emailInput);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEmailStep("code");
  }

  async function onVerifyEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!linkToken) return;
    setLoading(true);
    const result = await verifyAuthLinkEmailOtp(linkToken, otp);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.status === "merge_confirm") {
      setMergeToken(linkToken);
      return;
    }
    setAdding(null);
    router.refresh();
  }

  async function onConfirmMerge() {
    if (!mergeToken) return;
    setLoading(true);
    const result = await confirmAuthMethodMerge(mergeToken);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMergeToken(null);
    setAdding(null);
    router.refresh();
  }

  function cancelAdd() {
    setAdding(null);
    setLinkToken(null);
    setBotDeepLink(null);
    setEmailStep("email");
    setOtp("");
  }

  return (
    <div
      className="nl-aside-card nl-cabinet-auth-methods"
      id="auth-methods"
      data-testid="auth-methods"
    >
      <h3 className="nl-display nl-cabinet-section__title">Способы входа</h3>
      {error ? (
        <p className="caption" role="alert" style={{ color: "var(--cancel)" }}>
          {error}
        </p>
      ) : null}

      <ul className="nl-cabinet-auth-methods__list">
        {linked.map((method) => (
          <li key={method.providerId} className="nl-cabinet-auth-methods__row">
            <div className="nl-cabinet-auth-methods__info">
              <span className="nl-cabinet-auth-methods__label">
                {providerLabel(method.providerId)}
              </span>
              {method.detail ? (
                <span className="caption nl-mono nl-cabinet-auth-methods__detail">
                  {method.detail}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="nl-button nl-button--text nl-cabinet-auth-methods__unlink"
              disabled={loading || linked.length <= 1}
              onClick={() => void onUnlink(method)}
            >
              Отключить
            </button>
          </li>
        ))}
      </ul>

      {mergeToken ? (
        <div className="nl-field">
          <p className="caption">
            Этот способ уже привязан к другому аккаунту. Объединить записи и
            оплаты в текущий профиль?
          </p>
          <button
            type="button"
            className="nl-button nl-button--primary nl-button--block"
            disabled={loading}
            data-testid="auth-merge-confirm"
            onClick={() => void onConfirmMerge()}
          >
            Объединить аккаунты
          </button>
          <button
            type="button"
            className="nl-button nl-button--text nl-button--block"
            onClick={() => setMergeToken(null)}
          >
            Отмена
          </button>
        </div>
      ) : null}

      {!adding && !mergeToken && available.length > 0 ? (
        <div className="nl-cabinet-auth-methods__add">
          {available.map((providerId) => (
            <button
              key={providerId}
              type="button"
              className="nl-button nl-button--block"
              disabled={loading}
              data-testid={`auth-link-add-${providerId}`}
              onClick={() => void onPickProvider(providerId)}
            >
              {addProviderButtonLabel(providerId)}
            </button>
          ))}
        </div>
      ) : null}

      {adding === "email" && !mergeToken ? (
        <form
          className="nl-field"
          onSubmit={emailStep === "email" ? onSendEmailOtp : onVerifyEmailOtp}
        >
          {emailStep === "email" ? (
            <label className="nl-label" htmlFor="link-email">
              Email
              <input
                id="link-email"
                data-testid="auth-link-email-input"
                className="nl-input nl-input--mono"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
              />
            </label>
          ) : (
            <label className="nl-label" htmlFor="link-otp">
              Код из письма
              <input
                id="link-otp"
                data-testid="auth-link-otp-input"
                className="nl-input nl-input--mono"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </label>
          )}
          <button
            type="submit"
            className="nl-button nl-button--primary nl-button--block"
            disabled={loading}
          >
            {emailStep === "email" ? "Получить код" : "Подтвердить"}
          </button>
          <button
            type="button"
            className="nl-button nl-button--text nl-button--block"
            onClick={cancelAdd}
          >
            Отмена
          </button>
        </form>
      ) : null}

      {botDeepLink ? (
        <p className="caption">
          Откройте бота в Telegram:{" "}
          <a
            href={botDeepLink}
            className="nl-privacy__link"
            data-testid="telegram-bot-deeplink"
          >
            {botDeepLink}
          </a>
        </p>
      ) : null}
    </div>
  );
}
