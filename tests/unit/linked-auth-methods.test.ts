import { describe, expect, it } from "vitest";
import type { LinkedAuthMethod } from "@/lib/auth/linked-accounts";
import { listAvailableProvidersToLink } from "@/lib/auth/linked-accounts";

describe("listAvailableProvidersToLink", () => {
  it("returns all providers when nothing linked", () => {
    expect(listAvailableProvidersToLink([])).toEqual([
      "email",
      "telegram",
      "vk",
    ]);
  });

  it("hides linked providers", () => {
    const linked: LinkedAuthMethod[] = [
      { providerId: "email", detail: "a@b.c" },
      { providerId: "telegram", detail: "1" },
    ];
    expect(listAvailableProvidersToLink(linked)).toEqual(["vk"]);
  });
});
