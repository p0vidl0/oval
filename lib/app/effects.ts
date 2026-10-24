import { revalidatePath } from "next/cache";
import { publishFeedEvent } from "@/lib/realtime/feed-event-bus";
import { publishSessionRegistrationsChanged } from "@/lib/realtime/publish-session-registrations-changed";

/**
 * Единые эффекты после изменения записей: ревалидация всех экранов, где видна
 * запись (лента, кабинет, админка), и SSE со счётчиком по каждой тренировке.
 * Вызывается из server actions; сервисы домена эффектов не делают.
 */
export async function applyRegistrationEffects(
  sessionIds: readonly (string | null | undefined)[],
  options?: { realtime?: boolean; attendance?: boolean },
) {
  revalidatePath("/feed", "layout");
  revalidatePath("/cabinet", "layout");
  revalidatePath("/admin", "layout");
  if (options?.realtime === false) return;
  for (const sessionId of new Set(sessionIds)) {
    if (!sessionId) continue;
    await publishSessionRegistrationsChanged(sessionId);
    if (options?.attendance) {
      publishFeedEvent({ type: "session.attendance_changed", sessionId });
    }
  }
}
