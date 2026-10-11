export type UtmParams = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

const UTM_KEYS = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
} as const;

function trimUtm(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  return v.slice(0, 128);
}

export function utmFromSearchParams(
  params: URLSearchParams | Record<string, string | undefined>,
): UtmParams {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) {
      return trimUtm(params.get(key));
    }
    return trimUtm(params[key]);
  };

  return {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmContent: get("utm_content"),
    utmTerm: get("utm_term"),
  };
}

export function utmFromRecord(
  raw: Record<string, unknown> | undefined,
): UtmParams {
  if (!raw) return {};
  const out: UtmParams = {};
  for (const [snake, camel] of Object.entries(UTM_KEYS)) {
    const val = raw[snake] ?? raw[camel];
    if (typeof val === "string") {
      out[camel as keyof UtmParams] = trimUtm(val);
    }
  }
  return out;
}
