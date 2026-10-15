"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client-track";
import { authErrorText } from "@/lib/auth/auth-error-text";
import { authClient } from "@/lib/auth/client";
import { normalizeEmail } from "@/lib/auth/email";
import { safeInternalPath } from "@/lib/site/safe-internal-path";

type Step = "email" | "code";

function EmailUnstableNote() {
  return (
    <p className="caption" style={{ color: "var(--ink-muted)" }}>
      Почта может работать нестабильно. Если код не пришёл, войдите через
      Telegram или VK.
    </p>
  );
}

/** Пауза перед повторной отправкой кода. */
const RESEND_SECONDS = 60;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeInternalPath(searchParams.get("next"));

  const [step, setStep] = useState<Step>("email");
  const [emailInput, setEmailInput] = useState("");
  const [emailNormalized, setEmailNormalized] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const sendQueued = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function queueSend(email: string) {
    if (sendQueued.current) return;
    sendQueued.current = true;
    setError(null);
    setResendIn(RESEND_SECONDS);
    void authClient.emailOtp
      .sendVerificationOtp({
        email,
        type: "sign-in",
      })
      .then(({ error: sendError }) => {
        if (sendError) {
          setError(authErrorText(sendError, "Не удалось отправить код"));
        }
      })
      .finally(() => {
        sendQueued.current = false;
      });
  }

  function onResend() {
    if (resendIn > 0) return;
    queueSend(emailNormalized);
  }

  useEffect(() => {
    if (step === "email") {
      emailInputRef.current?.focus();
    } else {
      codeInputRef.current?.focus();
    }
  }, [step]);

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizeEmail(emailInput);
    if (!normalized) {
      setError("Введите корректный email");
      return;
    }
    if (resendIn > 0) return;
    setEmailNormalized(normalized);
    setStep("code");
    queueSend(normalized);
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: verifyError } = await authClient.signIn.emailOtp({
      email: emailNormalized,
      otp: code.trim(),
    });
    setLoading(false);
    if (verifyError) {
      setError(
        authErrorText(verifyError, "Не удалось войти. Попробуйте ещё раз."),
      );
      return;
    }
    trackAnalyticsEvent("login_success", {
      path: "/login",
      props: { authMethod: "email_otp" },
    });
    router.push(next);
    router.refresh();
  }

  return (
    <>
      {step === "email" ? (
        <form
          onSubmit={onSendCode}
          className="nl-field"
          style={{ marginTop: "var(--space-6)" }}
        >
          <label className="nl-label" htmlFor="login-email">
            Email
            <input
              ref={emailInputRef}
              id="login-email"
              data-testid="login-email"
              className="nl-input nl-input--mono nl-input--xl"
              type="email"
              autoComplete="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="caption" style={{ color: "var(--cancel)" }}>
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            data-testid="login-submit"
            disabled={resendIn > 0}
            className="nl-button nl-button--primary nl-button--block"
          >
            {resendIn > 0 ? `Получить код через ${resendIn} с` : "Получить код"}
          </button>
          <p className="caption" style={{ color: "var(--ink-muted)" }}>
            Пришлём код на почту. Если вы у нас впервые, аккаунт создадим сразу
            после подтверждения email.
          </p>
          <EmailUnstableNote />
        </form>
      ) : (
        <form
          onSubmit={onVerify}
          className="nl-field"
          style={{ marginTop: "var(--space-6)" }}
        >
          <p className="caption" style={{ color: "var(--ink-muted)" }}>
            Код отправлен на {emailNormalized}
          </p>
          <label className="nl-label" htmlFor="login-code">
            Код из письма
            <input
              ref={codeInputRef}
              id="login-code"
              data-testid="login-code"
              className="nl-input nl-input--mono"
              style={{ letterSpacing: "0.2em" }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="caption" style={{ color: "var(--cancel)" }}>
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            data-testid="login-submit"
            disabled={loading}
            className="nl-button nl-button--primary nl-button--block"
          >
            {loading ? "Проверка…" : "Войти"}
          </button>
          <button
            type="button"
            className="nl-button nl-button--text"
            disabled={resendIn > 0}
            onClick={onResend}
          >
            {resendIn > 0
              ? `Отправить код ещё раз через ${resendIn} с`
              : "Отправить код ещё раз"}
          </button>
          <button
            type="button"
            className="nl-button nl-button--text"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Другой email
          </button>
          <EmailUnstableNote />
        </form>
      )}

      <Link href="/feed" className="nl-button nl-button--text">
        К ленте
      </Link>
    </>
  );
}
