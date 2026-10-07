"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { authErrorText } from "@/lib/auth/auth-error-text";
import { authClient } from "@/lib/auth/client";
import {
  TelegramMiniAppContext,
  type TelegramMiniAppContextValue,
} from "@/lib/telegram/mini-app-context";
import {
  launchPathForStartParam,
  readTelegramLaunchSnapshot,
  TELEGRAM_LAUNCH_HASH_KEY,
  TELEGRAM_LAUNCH_INIT_DATA_KEY,
  TELEGRAM_WEB_APP_SDK_SRC,
  type TelegramLaunchSnapshot,
} from "@/lib/telegram/mini-app-launch";

const BOOT_WAIT_MS = 2500;
const BOOT_INTERVAL_MS = 100;

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

function readStorage(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function rememberLiveHash(): void {
  const live = window.location.hash;
  if (!live.includes("tgWebApp")) return;
  try {
    sessionStorage.setItem(TELEGRAM_LAUNCH_HASH_KEY, live);
    const initData = readTelegramLaunchSnapshot({
      liveHash: live,
      storedHash: "",
      storedInitData: "",
      search: "",
    }).initData;
    if (initData) {
      sessionStorage.setItem(TELEGRAM_LAUNCH_INIT_DATA_KEY, initData);
    }
  } catch {
    /* ignore */
  }
}

function readLaunch(): TelegramLaunchSnapshot {
  const webApp = window.Telegram?.WebApp;
  return readTelegramLaunchSnapshot({
    liveHash: window.location.hash,
    storedHash: readStorage(TELEGRAM_LAUNCH_HASH_KEY),
    storedInitData: readStorage(TELEGRAM_LAUNCH_INIT_DATA_KEY),
    search: window.location.search,
    sdkInitData: webApp?.initData,
    sdkPlatform: webApp?.platform,
    sdkStartParam: webApp?.initDataUnsafe?.start_param,
  });
}

function isFreshDocumentNavigation(): boolean {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    return !nav || nav.type === "navigate";
  } catch {
    return true;
  }
}

function ensureTelegramSdk(): void {
  if (document.querySelector(`script[src="${TELEGRAM_WEB_APP_SDK_SRC}"]`)) {
    return;
  }
  const script = document.createElement("script");
  script.src = TELEGRAM_WEB_APP_SDK_SRC;
  script.async = false;
  document.head.appendChild(script);
}

export function TelegramMiniAppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  const routerRef = useRef(router);
  routerRef.current = router;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const nextRef = useRef(nextParam);
  nextRef.current = nextParam;

  const [isMiniApp, setIsMiniApp] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const doneRef = useRef(false);
  const lastStartRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let activatedHandler: (() => void) | null = null;
    let activatedWebApp: TelegramWebApp | null = null;
    const started = Date.now();

    function persistInitData(initData: string): void {
      if (!initData) return;
      try {
        sessionStorage.setItem(TELEGRAM_LAUNCH_INIT_DATA_KEY, initData);
      } catch {
        /* ignore */
      }
    }

    function openStartParam(startParam: string | null): boolean {
      const path = launchPathForStartParam(startParam);
      if (!path || path === window.location.pathname) return false;
      lastStartRef.current = startParam;
      window.location.replace(path);
      return true;
    }

    function resumeFromNewLaunch(): void {
      rememberLiveHash();
      const launch = readLaunch();
      const start = launch.startParam;
      if (!start || start === lastStartRef.current) return;
      persistInitData(launch.initData);
      openStartParam(start);
    }

    function bindActivated(webApp: TelegramWebApp | undefined): void {
      if (!webApp?.onEvent || activatedHandler) return;
      activatedHandler = () => {
        if (!cancelled) resumeFromNewLaunch();
      };
      activatedWebApp = webApp;
      webApp.onEvent("activated", activatedHandler);
    }

    async function signIn(initData: string): Promise<void> {
      setAuthPending(true);
      setAuthError(null);
      try {
        let session = await authClient.getSession();
        if (cancelled) return;
        if (!session.data?.session) {
          if (!initData) {
            setAuthError(
              "Telegram не передал данные для входа. Закройте Mini App и откройте снова.",
            );
            return;
          }
          const res = await authClient.$fetch("/sign-in/telegram/mini-app", {
            method: "POST",
            body: { initData },
          });
          if (cancelled) return;
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
        if (cancelled || !session.data?.session) return;

        const next = nextRef.current;
        if (pathnameRef.current === "/login" && next?.startsWith("/")) {
          window.location.replace(next);
          return;
        }
        routerRef.current.refresh();
      } finally {
        if (!cancelled) setAuthPending(false);
      }
    }

    async function attempt(finalAttempt: boolean): Promise<void> {
      if (cancelled || doneRef.current) return;
      rememberLiveHash();
      const launch = readLaunch();
      if (!launch.isTelegram) {
        if (finalAttempt) doneRef.current = true;
        return;
      }

      setIsMiniApp(true);
      document.documentElement.classList.add("tg-mini-app");
      ensureTelegramSdk();
      const webApp = window.Telegram?.WebApp;
      webApp?.ready();
      webApp?.expand();
      if (webApp) applyTelegramTheme(webApp);
      bindActivated(webApp);

      const start =
        launch.startParam ??
        (finalAttempt && isFreshDocumentNavigation()
          ? launch.storedStartParam
          : null);
      const path = launchPathForStartParam(start);
      if (path && path !== window.location.pathname) {
        if (!launch.initData && !finalAttempt) return;
        persistInitData(launch.initData);
        doneRef.current = true;
        lastStartRef.current = start;
        window.location.replace(path);
        return;
      }

      if (!launch.initData && !finalAttempt) return;

      doneRef.current = true;
      lastStartRef.current = start ?? launch.storedStartParam;
      await signIn(launch.initData);
    }

    void attempt(false);
    const timer = window.setInterval(() => {
      if (Date.now() - started >= BOOT_WAIT_MS) {
        window.clearInterval(timer);
        void attempt(true);
        return;
      }
      void attempt(false);
    }, BOOT_INTERVAL_MS);

    function onHashChange(): void {
      if (doneRef.current) resumeFromNewLaunch();
      else void attempt(false);
    }
    window.addEventListener("hashchange", onHashChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("hashchange", onHashChange);
      if (activatedHandler && activatedWebApp?.offEvent) {
        activatedWebApp.offEvent("activated", activatedHandler);
      }
    };
  }, []);

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
