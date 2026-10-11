import { describe, expect, it } from "vitest";
import { getVkRedirectUri } from "@/lib/auth/vk/config";
import { vkAccountId, vkDisplayName, vkEmail } from "@/lib/auth/vk/profile";

describe("vk profile", () => {
  it("builds a display name and keeps a shared email", () => {
    const user = {
      user_id: 42,
      first_name: " Анна ",
      last_name: "Иванова",
      email: " Rider@Example.com ",
    };
    expect(vkAccountId(user)).toBe("42");
    expect(vkDisplayName(user, "42")).toBe("Анна Иванова");
    expect(vkEmail(user.email)).toBe("rider@example.com");
  });

  it("drops a missing or invalid email", () => {
    expect(vkEmail(undefined)).toBeNull();
    expect(vkEmail("not-an-email")).toBeNull();
    expect(vkDisplayName({ first_name: " " }, "7")).toBe("VK 7");
  });
});

describe("getVkRedirectUri", () => {
  it("uses the auth callback path", () => {
    expect(getVkRedirectUri("https://velodrom55.ru")).toBe(
      "https://velodrom55.ru/api/auth/callback/vk",
    );
    expect(getVkRedirectUri("https://velodrom55.ru/api/auth")).toBe(
      "https://velodrom55.ru/api/auth/callback/vk",
    );
  });
});
