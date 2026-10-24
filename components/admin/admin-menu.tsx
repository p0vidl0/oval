"use client";

import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

/**
 * Меню «…» для второстепенных действий. Пункты — кнопки форм или триггеры
 * `AdminDialog`. Панель скрывается, а не размонтируется: диалог, открытый
 * из пункта, живёт дальше (он в портале), а форма успевает отправиться.
 */
export function AdminMenu({
  label = "Ещё действия",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    rootRef.current
      ?.querySelector<HTMLElement>(
        ".nl-admin-menu__panel button, .nl-admin-menu__panel a",
      )
      ?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  // Выбор пункта закрывает меню; само действие (submit, диалог) продолжается.
  const onPanelClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) close();
  };

  return (
    <div ref={rootRef} className="nl-admin-menu">
      <button
        type="button"
        className="nl-button nl-button--sm nl-admin-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        …
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: клавиатура закрывает через Esc, Enter на пункте даёт тот же click */}
      <div
        id={panelId}
        role="menu"
        className="nl-admin-menu__panel"
        hidden={!open}
        onClick={onPanelClick}
      >
        {children}
      </div>
    </div>
  );
}
