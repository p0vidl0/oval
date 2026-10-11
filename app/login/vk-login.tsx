"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authErrorText } from "@/lib/auth/auth-error-text";
import { authClient } from "@/lib/auth/client";

export function VkLogin() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/cabinet";
  const failed = searchParams.get("error") === "vk";

  const [error, setError] = useState<string | null>(
    failed ? "Не удалось войти через VK. Попробуйте ещё раз." : null,
  );
  const [loading, setLoading] = useState(false);

  async function onVk() {
    setError(null);
    setLoading(true);
    try {
      const res = await authClient.$fetch("/vk/oauth/start", {
        method: "POST",
        body: { next },
      });
      if (res.error || !res.data) {
        setError(authErrorText(res.error, "Не удалось начать вход через VK"));
        return;
      }
      const data = res.data as { authorizationUrl: string };
      window.location.assign(data.authorizationUrl);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-testid="vk-login">
      <button
        type="button"
        className="nl-button nl-button--primary nl-button--block"
        disabled={loading}
        data-testid="vk-login-button"
        onClick={() => void onVk()}
      >
        {loading ? "…" : "Войти через VK"}
      </button>
      {error ? (
        <p className="nl-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
