"use server";

import { redirect } from "next/navigation";
import { recordServerEvent } from "@/lib/analytics/record-event";
import { applyRegistrationEffects } from "@/lib/app/effects";
import { getServerSession } from "@/lib/auth/session";
import { postPath } from "@/lib/feed/open-post-url";
import { getFeedPostById } from "@/lib/feed/queries";
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
  const post = feedPostId ? await getFeedPostById(feedPostId) : null;
  const postPublicPath = post ? postPath(post.slug) : null;
  if (!session) {
    redirect(
      postPublicPath
        ? `/login?next=${encodeURIComponent(postPublicPath)}`
        : "/login?next=/feed",
    );
  }

  const result = await registerUserForSession(session.user.id, sessionId);

  if (!result.ok) {
    return { ok: false, error: result.error, feedPostId };
  }

  await applyRegistrationEffects([result.sessionId]);

  await recordServerEvent({
    name: "registration_complete",
    path: postPublicPath ?? "/feed",
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
