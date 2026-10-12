import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP } from "better-auth/plugins";
import {
  readBetterAuthAdvancedOptions,
  resolveBetterAuthBaseURL,
} from "@/lib/auth/base-url-config";
import { telegram } from "@/lib/auth/plugins/telegram";
import { vk } from "@/lib/auth/plugins/vk";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { sendAuthEmailOtp } from "@/lib/email/send-otp";

const advanced = readBetterAuthAdvancedOptions();

export const auth = betterAuth({
  appName: "oval",
  baseURL: resolveBetterAuthBaseURL(),
  secret: process.env.BETTER_AUTH_SECRET,
  ...(Object.keys(advanced).length > 0 ? { advanced } : {}),
  rateLimit: {
    customRules: {
      "/email-otp/send-verification-otp": { window: 600, max: 5 },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  user: {
    additionalFields: {
      rosterNameVisible: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["vk"],
    },
  },
  plugins: [
    emailOTP({
      expiresIn: 600,
      allowedAttempts: 3,
      resendStrategy: "reuse",
      rateLimit: { window: 600, max: 5 },
      sendVerificationOTP: async ({ email, otp }) => {
        await sendAuthEmailOtp(email, otp);
      },
    }),
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    telegram(),
    vk(),
  ],
});

export type Session = typeof auth.$Infer.Session;
