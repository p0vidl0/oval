import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readDevTunnelHost,
  resolveBetterAuthBaseURL,
} from "@/lib/auth/base-url-config";

describe("resolveBetterAuthBaseURL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses static URL in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", "https://example.com");
    expect(resolveBetterAuthBaseURL()).toBe("https://example.com");
  });

  it("allows ngrok hosts in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    const config = resolveBetterAuthBaseURL();
    expect(typeof config).toBe("object");
    if (typeof config === "string") throw new Error("expected object");
    expect(config.allowedHosts).toContain("*.ngrok-free.dev");
    expect(config.fallback).toBe("http://localhost:3000");
  });

  it("parses NEXT_DEV_TUNNEL_HOST", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_DEV_TUNNEL_HOST", "sub.ngrok-free.dev");
    expect(readDevTunnelHost()).toBe("sub.ngrok-free.dev");
    const config = resolveBetterAuthBaseURL();
    if (typeof config === "string") throw new Error("expected object");
    expect(config.allowedHosts).toContain("sub.ngrok-free.dev");
  });
});
