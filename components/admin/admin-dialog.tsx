"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  triggerLabel: ReactNode;
  triggerClassName?: string;
  triggerDisabled?: boolean;
  /** Широкая панель для форм с несколькими колонками. */
  wide?: boolean;
  children: (close: () => void) => ReactNode;
};

/** Модальное окно с кнопкой-триггером: портал, Esc, фокус, блок прокрутки. */
export function AdminDialog({
  title,
  triggerLabel,
  triggerClassName = "nl-button",
  triggerDisabled,
  wide,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button",
    );
    focusable?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        disabled={triggerDisabled}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      {open
        ? createPortal(
            <div
              className="nl-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <button
                type="button"
                className="nl-dialog__backdrop"
                aria-label="Закрыть"
                onClick={close}
              />
              <div
                ref={panelRef}
                className={`nl-dialog__panel${wide ? " nl-dialog__panel--wide" : ""}`}
              >
                <h2 id={titleId} className="nl-dialog__title">
                  {title}
                </h2>
                {children(close)}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function DialogActions({
  onCancel,
  submitLabel,
  submitClassName = "nl-button nl-button--primary nl-button--sm",
}: {
  onCancel: () => void;
  submitLabel: ReactNode;
  submitClassName?: string;
}) {
  return (
    <div className="nl-dialog__actions">
      <button
        type="button"
        className="nl-button nl-button--text nl-button--sm"
        onClick={onCancel}
      >
        Отмена
      </button>
      <button type="submit" className={submitClassName}>
        {submitLabel}
      </button>
    </div>
  );
}
