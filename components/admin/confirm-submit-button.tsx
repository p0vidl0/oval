"use client";

import { useFormStatus } from "react-dom";

/** Кнопка отправки формы с `confirm()`, как у остальных необратимых действий. */
export function ConfirmSubmitButton({
  label,
  pendingLabel,
  confirmMessage,
  className = "nl-button nl-button--sm",
}: {
  label: string;
  pendingLabel: string;
  confirmMessage: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`${className}${pending ? " nl-button--pending" : ""}`}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
