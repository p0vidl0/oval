import type { Metadata } from "next";
import { pageDocumentTitle } from "@/lib/site/public-origin";

export const metadata: Metadata = {
  title: { absolute: pageDocumentTitle("Вход через Telegram") },
};

export default function TelegramCompleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
