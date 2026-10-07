"use client";

import type { ReactNode } from "react";
import { cancelRegistrationForm } from "@/lib/training/cancel-action";

const CONFIRM = "Отменить запись? Место освободится для других.";

/** «Отменить запись» с подтверждением. Сервер повторно проверяет, можно ли отменять. */
export function CancelRegistrationForm({
  registrationId,
  returnTo,
  className = "nl-button nl-button--text",
  children = "Отменить запись",
}: {
  registrationId: string;
  returnTo: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <form
      action={cancelRegistrationForm}
      onSubmit={(event) => {
        if (!confirm(CONFIRM)) event.preventDefault();
      }}
    >
      <input type="hidden" name="registration_id" value={registrationId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
