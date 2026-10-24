"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_DELAY_MS = 300;

/**
 * Список тренировки обновляется, когда другой тренер отмечает посещение или
 * меняются записи (SSE `/api/feed/events`, как в ленте).
 */
export function SessionLiveRefresh({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource("/api/feed/events");
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as {
          type?: string;
          sessionId?: string;
        };
        if (
          event.sessionId === sessionId &&
          (event.type === "session.attendance_changed" ||
            event.type === "session.registrations_changed")
        ) {
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
        }
      } catch {
        // Не JSON (heartbeat приходит комментарием) — пропускаем.
      }
    };
    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [router, sessionId]);

  return null;
}
