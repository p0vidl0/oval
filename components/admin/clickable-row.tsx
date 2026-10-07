"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Строка таблицы, ведущая на `href` по клику в любом месте.
 * Ссылку внутри строки оставляем — для клавиатуры, скринридеров и «открыть в новой вкладке».
 */
export function ClickableRow({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className="nl-table__row--link"
      onClick={(e) => {
        // Клик по ссылке/кнопке внутри строки обрабатывает она сама.
        if ((e.target as HTMLElement).closest("a, button, input, select")) {
          return;
        }
        // Не мешаем выделять текст.
        if (window.getSelection()?.toString()) return;
        if (e.metaKey || e.ctrlKey) {
          window.open(href, "_blank", "noopener");
          return;
        }
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
