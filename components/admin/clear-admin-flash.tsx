"use client";

import { useEffect } from "react";

/** Параметры результата действия: после показа баннера убираются из URL. */
export const ADMIN_FLASH_PARAMS = ["done", "error", "count", "post"] as const;

/**
 * Баннер показывается один раз: параметры убираются из адреса без запроса
 * к серверу (баннер остаётся на экране), а при обновлении его уже нет.
 */
export function ClearAdminFlash() {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of ADMIN_FLASH_PARAMS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);

  return null;
}
