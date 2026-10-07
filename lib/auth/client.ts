import { adminClient, emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { telegramClient } from "@/lib/auth/plugins/telegram-client";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), adminClient(), telegramClient()],
});
