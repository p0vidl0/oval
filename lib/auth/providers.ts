/** Better Auth / custom OAuth provider ids stored in `account.provider_id`. */
export const AUTH_PROVIDER_IDS = {
  email: "email",
  telegram: "telegram",
  vk: "vk",
} as const;

export type AuthProviderId =
  (typeof AUTH_PROVIDER_IDS)[keyof typeof AUTH_PROVIDER_IDS];

export const LINKABLE_PROVIDERS: AuthProviderId[] = [
  AUTH_PROVIDER_IDS.email,
  AUTH_PROVIDER_IDS.telegram,
  AUTH_PROVIDER_IDS.vk,
];

export function providerLabel(providerId: string): string {
  switch (providerId) {
    case AUTH_PROVIDER_IDS.email:
      return "Email";
    case AUTH_PROVIDER_IDS.telegram:
      return "Telegram";
    case AUTH_PROVIDER_IDS.vk:
      return "VK ID";
    default:
      return providerId;
  }
}

export function addProviderButtonLabel(providerId: string): string {
  switch (providerId) {
    case AUTH_PROVIDER_IDS.email:
      return "Добавить Email";
    case AUTH_PROVIDER_IDS.telegram:
      return "Добавить Telegram";
    case AUTH_PROVIDER_IDS.vk:
      return "Добавить VK";
    default:
      return `Добавить ${providerId}`;
  }
}
