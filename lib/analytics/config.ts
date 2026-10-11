export function isOvalAnalyticsEnabled(): boolean {
  const raw = process.env.OVAL_ANALYTICS_ENABLED?.trim();
  return raw === "1" || raw === "true";
}

export function getPrivacyContactEmail(): string {
  return (
    process.env.OVAL_PRIVACY_CONTACT_EMAIL?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    "privacy@example.local"
  );
}

export function getPrivacyOperatorName(): string {
  return process.env.OVAL_PRIVACY_OPERATOR_NAME?.trim() || siteNameFallback();
}

function siteNameFallback(): string {
  return "Ночная лига";
}
