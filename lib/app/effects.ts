import { revalidatePath } from "next/cache";
import { postPath } from "@/lib/feed/open-post-url";
import { isPostLive } from "@/lib/feed/publication";
import { getAnnouncementForSession } from "@/lib/feed/queries";
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
  revalidatePath("/", "layout");
  revalidatePath("/cabinet", "layout");
  revalidatePath("/admin", "layout");
  for (const sessionId of new Set(sessionIds)) {
    if (!sessionId) continue;
    const announcement = await getAnnouncementForSession(sessionId);
    if (announcement && isPostLive(announcement)) {
      revalidatePath(postPath(announcement.slug));
    }
  }
  if (options?.realtime === false) return;
  for (const sessionId of new Set(sessionIds)) {
    if (!sessionId) continue;
    await publishSessionRegistrationsChanged(sessionId);
    if (options?.attendance) {
      publishFeedEvent({ type: "session.attendance_changed", sessionId });
    }
  }
}
