export type AnalyticsConsent = "granted" | "denied";

export const ANALYTICS_CONSENT_STORAGE_KEY = "oval_analytics_consent";
/** Set on `<html>` before paint so a stored decision does not flash the banner. */
export const ANALYTICS_CONSENT_DOCUMENT_ATTR = "data-analytics-consent";
export const ANALYTICS_UTM_SESSION_KEY = "oval_analytics_utm";

export function parseAnalyticsConsent(
  raw: string | null | undefined,
): AnalyticsConsent | null {
  if (raw === "granted" || raw === "denied") return raw;
  return null;
}

function storage(): Storage | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  return globalThis.localStorage;
}

export function readAnalyticsConsentFromStorage(): AnalyticsConsent | null {
  try {
    return parseAnalyticsConsent(
      storage()?.getItem(ANALYTICS_CONSENT_STORAGE_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeAnalyticsConsentToStorage(value: AnalyticsConsent): void {
  try {
    storage()?.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
  } catch {
    // ignore quota / private mode
  }
}

/** Blocking inline script: runs while HTML is parsed, before the banner paints. */
export function analyticsConsentBootstrapScript(): string {
  const key = JSON.stringify(ANALYTICS_CONSENT_STORAGE_KEY);
  const attr = JSON.stringify(ANALYTICS_CONSENT_DOCUMENT_ATTR);
  return `(function(){try{var v=localStorage.getItem(${key});if(v==="granted"||v==="denied"){document.documentElement.setAttribute(${attr},v);}}catch(e){}})();`;
}
