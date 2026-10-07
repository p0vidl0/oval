"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { authErrorText } from "@/lib/auth/auth-error-text";
import { authClient } from "@/lib/auth/client";
import {
  TelegramMiniAppContext,
  type TelegramMiniAppContextValue,
} from "@/lib/telegram/mini-app-context";
import { resolveStartParamRoute } from "@/lib/telegram/mini-app-start-param";

const TG_SCRIPT = "https://telegram.org/js/telegram-web-app.js";
const START_PARAM_STORAGE_PREFIX = "tg-start-param:";

function applyTelegramTheme(webApp: TelegramWebApp): void {
  const root = document.documentElement;
  const tp = webApp.themeParams;
  if (tp.bg_color) {
    root.style.setProperty("--tg-theme-bg-color", tp.bg_color);
  }
  if (tp.text_color) {
    root.style.setProperty("--tg-theme-text-color", tp.text_color);
  }
}

function startParamHandled(param: string): boolean {
  try {
    return (
      sessionStorage.getItem(`${START_PARAM_STORAGE_PREFIX}${param}`) === "1"
    );
  } catch {
    return false;
  }
}

function markStartParamHandled(param: string): void {
  try {
    sessionStorage.setItem(`${START_PARAM_STORAGE_PREFIX}${param}`, "1");
  } catch {
    /* ignore */
  }
}

function shouldApplyStartParam(next: string | null): boolean {
  if (!next) return true;
  return next === "/cabinet";
}

function isLikelyTelegramWebView(): boolean {
  if (typeof window === "undefined") return false;
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return false;
  return webApp.platform !== "unknown" || Boolean(webApp.initData?.trim());
}

async function readInitData(webApp: TelegramWebApp): Promise<string> {
  webApp.ready();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const data = webApp.initData?.trim();
    if (data) return data;
    await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
  }
  return webApp.initData?.trim() ?? "";
}

export function TelegramMiniAppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  const [sdkHint, setSdkHint] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const bootstrappedRef = useRef(false);

  const tryBootstrap = useCallback(async () => {
    if (bootstrappedRef.current) return;
    if (!isLikelyTelegramWebView()) {
      if (sdkHint) bootstrappedRef.current = true;
      return;
    }

    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;

    bootstrappedRef.current = true;
    setIsMiniApp(true);
    document.documentElement.classList.add("tg-mini-app");

    webApp.expand();
    applyTelegramTheme(webApp);

    const initData = await readInitData(webApp);
    if (!initData) {
      setAuthError(
        "Telegram не передал данные для входа. Закройте Mini App и откройте снова.",
      );
      return;
    }

    setAuthPending(true);
    setAuthError(null);
    try {
      let session = await authClient.getSession();
      if (!session.data?.session) {
        const res = await authClient.$fetch("/sign-in/telegram/mini-app", {
          method: "POST",
          body: { initData },
        });
        if (res.error) {
          setAuthError(
            authErrorText(
              res.error,
              "Не удалось войти через Telegram. Проверьте TELEGRAM_BOT_TOKEN на сервере.",
            ),
          );
          return;
        }
        session = await authClient.getSession();
      }

      router.refresh();

      if (pathname === "/login" && nextParam?.startsWith("/")) {
        router.replace(nextParam);
        return;
      }

      const startParam = webApp.initDataUnsafe.start_param;
      if (
        startParam &&
        shouldApplyStartParam(nextParam) &&
        !startParamHandled(startParam)
      ) {
        const route = resolveStartParamRoute(startParam);
        if (route) {
          markStartParamHandled(startParam);
          router.replace(route.path);
        }
      }
    } finally {
      setAuthPending(false);
    }
  }, [sdkHint, pathname, nextParam, router]);

  useEffect(() => {
    void tryBootstrap();
  }, [tryBootstrap]);

  useEffect(() => {
    if (sdkHint) void tryBootstrap();
  }, [sdkHint, tryBootstrap]);

  const contextValue = useMemo<TelegramMiniAppContextValue>(
    () => ({
      isMiniApp,
      authPending,
      authError,
    }),
    [isMiniApp, authPending, authError],
  );

  return (
    <TelegramMiniAppContext.Provider value={contextValue}>
      <Script
        src={TG_SCRIPT}
        strategy="afterInteractive"
        onReady={() => setSdkHint(true)}
      />
      {isMiniApp && authError ? (
        <div
          className="nl-mini-app-auth-error"
          role="alert"
          data-testid="telegram-mini-app-auth-error"
        >
          {authError}
        </div>
      ) : null}
      {children}
    </TelegramMiniAppContext.Provider>
  );
}
