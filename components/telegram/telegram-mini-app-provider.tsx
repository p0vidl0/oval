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

export function TelegramMiniAppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  const [scriptReady, setScriptReady] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const bootstrappedRef = useRef(false);

  const getWebApp = useCallback((): TelegramWebApp | null => {
    if (typeof window === "undefined") return null;
    const webApp = window.Telegram?.WebApp;
    if (!webApp?.initData?.trim()) return null;
    return webApp;
  }, []);

  useEffect(() => {
    if (!scriptReady || bootstrappedRef.current) return;

    const webApp = getWebApp();
    if (!webApp) {
      bootstrappedRef.current = true;
      return;
    }

    bootstrappedRef.current = true;
    setIsMiniApp(true);
    document.documentElement.classList.add("tg-mini-app");

    const activeWebApp = webApp;
    activeWebApp.ready();
    activeWebApp.expand();
    applyTelegramTheme(activeWebApp);

    let cancelled = false;

    async function bootstrap() {
      setAuthPending(true);
      setAuthError(null);
      try {
        const session = await authClient.getSession();
        if (cancelled) return;

        if (!session.data?.session) {
          const res = await authClient.$fetch("/sign-in/telegram/mini-app", {
            method: "POST",
            body: { initData: activeWebApp.initData },
          });
          if (cancelled) return;
          if (res.error) {
            setAuthError(
              authErrorText(res.error, "Не удалось войти через Telegram"),
            );
            return;
          }
        }

        if (pathname === "/login" && nextParam?.startsWith("/")) {
          router.replace(nextParam);
          return;
        }

        const startParam = activeWebApp.initDataUnsafe.start_param;
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
        if (!cancelled) setAuthPending(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [scriptReady, getWebApp, pathname, nextParam, router]);

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
        onReady={() => setScriptReady(true)}
      />
      {children}
    </TelegramMiniAppContext.Provider>
  );
}
