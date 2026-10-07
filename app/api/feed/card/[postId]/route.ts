import { NextResponse } from "next/server";
import { loadFeedLiveCardForPost } from "@/lib/feed/load-feed-live-card";

type Props = {
  params: Promise<{ postId: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { postId } = await params;
  const card = await loadFeedLiveCardForPost(postId);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(card);
}
