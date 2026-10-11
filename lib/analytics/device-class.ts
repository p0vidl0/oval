export type DeviceClass = "mobile" | "desktop" | "unknown";

export function deviceClassFromUserAgent(
  userAgent: string | null | undefined,
): DeviceClass {
  const ua = userAgent?.toLowerCase() ?? "";
  if (!ua) return "unknown";
  if (/mobile|android|iphone|ipad|ipod|webos|blackberry/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}
