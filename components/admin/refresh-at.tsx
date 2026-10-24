"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Запас после границы: сервер точно увидит, что момент наступил. */
const AFTER_MOMENT_MS = 1000;
/** `setTimeout` хранит задержку в int32 (~24.8 дня); дальше — перепланируем. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Перерисовать страницу с сервера, когда наступает граничный момент (открытие
 * окна отметки, старт, закрытие окна) — без перезагрузки. Кнопки появляются
 * через ту же серверную логику, правила на клиенте не дублируются.
 *
 * Время — по часам сервера (`serverNow`): если часы телефона спешат, иначе
 * обновление пришло бы раньше, чем сервер «увидит» момент. Фоновая вкладка и
 * спящий телефон тормозят таймеры, поэтому при возврате на вкладку пропущенный
 * момент догоняется сразу.
 */
export function RefreshAt({
  moments,
  serverNow,
}: {
  /** ISO-строки; прошедшие на момент рендера игнорируются. */
  moments: string[];
  serverNow: string;
}) {
  const router = useRouter();
  const key = moments.join("|");

  useEffect(() => {
    const renderedAt = Date.parse(serverNow);
    const offset = renderedAt - Date.now();
    const now = () => Date.now() + offset;
    const pending = key
      .split("|")
      .filter(Boolean)
      .map((m) => Date.parse(m))
      .filter((m) => m > renderedAt)
      .sort((a, b) => a - b);
    const next = pending[0];
    if (next === undefined) return;

    let refreshed = false;
    const refresh = () => {
      if (refreshed) return;
      refreshed = true;
      router.refresh();
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const delay = next - now() + AFTER_MOMENT_MS;
      if (delay <= 0) {
        refresh();
        return;
      }
      timer = setTimeout(schedule, Math.min(delay, MAX_TIMEOUT_MS));
    };
    schedule();

    const onReturn = () => {
      if (document.visibilityState === "visible" && now() >= next) refresh();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [key, serverNow, router]);

  return null;
}
