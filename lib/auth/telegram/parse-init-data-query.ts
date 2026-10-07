/** Parse Telegram WebApp initData query (decoded values, as in Telegram validation examples). */
export function parseInitDataQuery(initData: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of initData.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    const value = decodeURIComponent(part.slice(eq + 1));
    map.set(key, value);
  }
  return map;
}

export function buildInitDataCheckString(fields: Map<string, string>): string {
  const pairs: string[] = [];
  for (const [key, value] of fields.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  return pairs.join("\n");
}
