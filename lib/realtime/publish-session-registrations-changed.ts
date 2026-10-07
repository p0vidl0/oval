import { publishFeedEvent } from "@/lib/realtime/feed-event-bus";
import { countActiveRegistrations } from "@/lib/training/registrations";

export async function publishSessionRegistrationsChanged(
  sessionId: string,
): Promise<void> {
  const activeCount = await countActiveRegistrations(sessionId);
  publishFeedEvent({
    type: "session.registrations_changed",
    sessionId,
    activeCount,
  });
}
