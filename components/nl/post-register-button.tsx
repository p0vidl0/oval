"use client";

import { useRouter } from "next/navigation";
import { FeedRegisterButton } from "@/components/nl/feed-register-button";

/** «Записаться» на странице поста: после записи перерисовываем страницу. */
export function PostRegisterButton(props: {
  sessionId: string;
  postId: string;
  needsName: boolean;
}) {
  const router = useRouter();
  return <FeedRegisterButton {...props} onSuccess={() => router.refresh()} />;
}
