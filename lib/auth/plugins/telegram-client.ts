export const telegramClient = () => {
  return {
    id: "telegram",
    version: "1.0.0",
    $InferServerPlugin: {} as ReturnType<
      typeof import("@/lib/auth/plugins/telegram").telegram
    >,
    atomListeners: [
      {
        matcher: (path: string) =>
          path === "/sign-in/telegram/oidc" ||
          path === "/sign-in/telegram/bot" ||
          path === "/sign-in/telegram/oidc/callback",
        signal: "$sessionSignal" as const,
      },
    ],
  };
};
