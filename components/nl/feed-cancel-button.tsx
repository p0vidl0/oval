"use client";

import { useState, useTransition } from "react";
import { cancelRegistrationClient } from "@/lib/training/cancel-action";

const CONFIRM = "Отменить запись? Место освободится для других.";

/** «Отменить запись» в карточке ленты: подтверждение, без перезагрузки. */
export function FeedCancelButton({
  registrationId,
  onSuccess,
}: {
  registrationId: string;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className="nl-button nl-button--text"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (!confirm(CONFIRM)) return;
          setError(null);
          startTransition(async () => {
            const result = await cancelRegistrationClient(registrationId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            onSuccess();
          });
        }}
      >
        {pending ? "Отменяем…" : "Отменить запись"}
      </button>
      {error ? (
        <p
          className="caption"
          role="alert"
          style={{ color: "var(--cancel)", marginTop: "var(--space-2)" }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
