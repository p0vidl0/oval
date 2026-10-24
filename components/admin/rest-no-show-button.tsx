"use client";

import { useState, useTransition } from "react";
import { markRestNoShowAction } from "@/lib/admin/attendance-actions";

/** «Остальные не пришли»: закрыть список одним действием после старта. */
export function RestNoShowButton({
  sessionId,
  count,
}: {
  sessionId: string;
  count: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        className={`nl-button nl-button--sm${pending ? " nl-button--pending" : ""}`}
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (!confirm(`Отметить «Не пришёл» у ${count} неотмеченных?`)) return;
          setError(null);
          startTransition(async () => {
            const result = await markRestNoShowAction({ sessionId });
            if (result.status === "error") setError(result.message);
          });
        }}
      >
        {pending ? "Отмечаем…" : `Остальные не пришли (${count})`}
      </button>
      {error ? (
        <p className="caption nl-error-text" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
