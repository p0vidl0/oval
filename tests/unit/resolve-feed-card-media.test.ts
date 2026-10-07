import { describe, expect, it } from "vitest";
import { resolveFeedCardMedia } from "@/components/nl/feed-card/resolve-media";

const imgs = [
  { src: "/a.jpg", alt: "a" },
  { src: "/b.jpg", alt: "b" },
];

describe("resolveFeedCardMedia", () => {
  it("uses header cover only for pinned announcements", () => {
    const pinned = resolveFeedCardMedia("training_announcement", imgs, 2, true);
    expect(pinned.coverImage?.src).toBe("/a.jpg");
    expect(pinned.sideImage).toBeNull();
    expect(pinned.withCoverClass).toBe(true);

    const normal = resolveFeedCardMedia(
      "training_announcement",
      imgs,
      2,
      false,
    );
    expect(normal.coverImage).toBeNull();
    expect(normal.sideImage?.src).toBe("/a.jpg");
    expect(normal.withCoverClass).toBe(false);
    expect(normal.galleryImages).toHaveLength(1);
  });

  it("keeps news photos inline", () => {
    const media = resolveFeedCardMedia("news", imgs);
    expect(media.coverImage).toBeNull();
    expect(media.sideImage).toBeNull();
    expect(media.galleryImages).toHaveLength(2);
  });
});
