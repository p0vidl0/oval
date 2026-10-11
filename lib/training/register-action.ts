"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordServerEvent } from "@/lib/analytics/record-event";
import { getServerSession } from "@/lib/auth/session";
import { publishSessionRegistrationsChanged } from "@/lib/realtime/publish-session-registrations-changed";
import { registerUserForSession } from "@/lib/training/registrations";

export type RegisterForTrainingResult =
  | {
      ok: true;
      registrationId: string;
      needsPayment: boolean;
      feedPostId: string;
    }
  | { ok: false; error: string; feedPostId: string };

export async function registerForTrainingClient(
  sessionId: string,
  feedPostId: string,
): Promise<RegisterForTrainingResult> {
  const session = await getServerSession();
  if (!session) {
    redirect(
      feedPostId ? `/login?next=/feed/${feedPostId}` : "/login?next=/feed",
    );
  }

  const result = await registerUserForSession(session.user.id, sessionId);

  if (!result.ok) {
    return { ok: false, error: result.error, feedPostId };
  }

  revalidatePath("/feed");
  if (feedPostId) revalidatePath(`/feed/${feedPostId}`);
  revalidatePath("/cabinet");

  await publishSessionRegistrationsChanged(result.sessionId);

  await recordServerEvent({
    name: "registration_complete",
    path: feedPostId ? `/feed/${feedPostId}` : "/feed",
    props: {
      registrationId: result.registrationId,
      sessionId: result.sessionId,
      postId: feedPostId,
    },
  });

  if (result.needsPayment) {
    redirect(`/cabinet/pay/${result.registrationId}`);
  }

  return {
    ok: true,
    registrationId: result.registrationId,
    needsPayment: result.needsPayment,
    feedPostId,
  };
}
