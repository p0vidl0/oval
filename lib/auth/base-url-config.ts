import { readTrustedProxies } from "@/lib/auth/trusted-proxies";

/** Hostname from `NEXT_DEV_TUNNEL_HOST` (no scheme/path). */
export function readDevTunnelHost(): string | undefined {
  const raw = process.env.NEXT_DEV_TUNNEL_HOST?.trim();
  if (!raw) return undefined;
  const withoutScheme = raw.replace(/^https?:\/\//, "");
  const host = withoutScheme.split("/")[0]?.trim();
  return host || undefined;
}

function hostFromConfiguredBaseUrl(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function isLocalDevAuth(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Dev: resolve base URL + trusted origins from the request Host (ngrok, localhost).
 * Prod: static `BETTER_AUTH_URL` only.
 */
export function resolveBetterAuthBaseURL():
  | string
  | {
      allowedHosts: string[];
      protocol: "auto";
      fallback: string;
    } {
  const configured = process.env.BETTER_AUTH_URL?.trim();

  if (!isLocalDevAuth()) {
    return configured ?? "";
  }

  const fallback =
    configured && configured.length > 0
      ? configured.replace(/\/$/, "")
      : "http://localhost:3000";

  const tunnelHost = readDevTunnelHost();
  const configuredHost = configured
    ? hostFromConfiguredBaseUrl(configured)
    : undefined;

  const allowedHosts = [
    "localhost:3000",
    "127.0.0.1:3000",
    ...(tunnelHost ? [tunnelHost] : []),
    ...(configuredHost &&
    !configuredHost.startsWith("localhost:") &&
    !configuredHost.startsWith("127.0.0.1:")
      ? [configuredHost]
      : []),
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ];

  return {
    allowedHosts: [...new Set(allowedHosts)],
    protocol: "auto",
    fallback,
  };
}

export function readBetterAuthAdvancedOptions(): {
  ipAddress?: { trustedProxies: string[] };
  trustedProxyHeaders?: boolean;
} {
  const trustedProxies = readTrustedProxies();
  const advanced: {
    ipAddress?: { trustedProxies: string[] };
    trustedProxyHeaders?: boolean;
  } = {};

  if (trustedProxies) {
    advanced.ipAddress = { trustedProxies };
  }
  if (isLocalDevAuth()) {
    advanced.trustedProxyHeaders = true;
  }

  return advanced;
}
