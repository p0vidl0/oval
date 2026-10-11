import { normalizeEmail } from "@/lib/auth/email";

export type VkProfileUser = {
  user_id?: string | number;
  first_name?: string;
  last_name?: string;
  email?: string;
  avatar?: string;
};

export function vkAccountId(user: VkProfileUser): string | null {
  if (user.user_id === undefined || user.user_id === null) return null;
  const id = String(user.user_id).trim();
  return id || null;
}

export function vkDisplayName(user: VkProfileUser, accountId: string): string {
  const parts = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return `VK ${accountId}`;
}

/** VK ID email, or null when the user did not share one. */
export function vkEmail(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  return normalizeEmail(raw);
}
