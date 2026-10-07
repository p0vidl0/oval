import type { Metadata } from "next";
import { Suspense } from "react";
import { TelegramMiniAppProvider } from "@/components/telegram/telegram-mini-app-provider";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ночная лига",
  description: "Вечерние тренировки на велотреке",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${fontVariables} h-full`}>
      <body className="nl-root flex min-h-full flex-col">
        <Suspense fallback={null}>
          <TelegramMiniAppProvider>{children}</TelegramMiniAppProvider>
        </Suspense>
      </body>
    </html>
  );
}
