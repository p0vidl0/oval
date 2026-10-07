"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { authErrorText } from "@/lib/auth/auth-error-text";
import { authClient } from "@/lib/auth/client";

function TelegramCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const next = searchParams.get("next") ?? "/cabinet";

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Нет токена входа. Вернитесь в Telegram и начните снова.");
      return;
    }

    let cancelled = false;
    (async () => {
      const res = await authClient.$fetch("/sign-in/telegram/bot", {
        method: "POST",
        body: { token },
      });
      if (cancelled) return;
      if (res.error) {
        setError(
          authErrorText(
            res.error,
            "Не удалось завершить вход. Подтвердите вход в Telegram и попробуйте снова.",
          ),
        );
        return;
      }
      router.replace(next.startsWith("/") ? next : "/cabinet");
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [token, next, router]);

  if (error) {
    return (
      <main
        className="nl-page"
        style={{ maxWidth: 480, margin: "var(--space-8) auto" }}
      >
        <h1 className="nl-display">Вход через Telegram</h1>
        <p className="nl-field-error" role="alert">
          {error}
        </p>
        <p style={{ marginTop: "var(--space-4)" }}>
          <Link href="/login">Вернуться ко входу</Link>
        </p>
      </main>
    );
  }

  return (
    <main
      className="nl-page"
      style={{ maxWidth: 480, margin: "var(--space-8) auto" }}
    >
      <h1 className="nl-display">Вход через Telegram</h1>
      <p className="caption" style={{ color: "var(--ink-muted)" }}>
        Завершаем вход…
      </p>
    </main>
  );
}

export default function TelegramCompletePage() {
  return (
    <Suspense
      fallback={
        <main
          className="nl-page"
          style={{ maxWidth: 480, margin: "var(--space-8) auto" }}
        >
          <p className="caption">Загрузка…</p>
        </main>
      }
    >
      <TelegramCompleteInner />
    </Suspense>
  );
}
