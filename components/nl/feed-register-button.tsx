"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { NamePromptDialog } from "@/components/nl/name-prompt-dialog";
import { registerForTrainingClient } from "@/lib/training/register-action";

type Props = {
  sessionId: string;
  postId: string;
  /** У пользователя нет имени — перед записью спросить «Как вас записать?». */
  needsName?: boolean;
  onSuccess: (result: {
    registrationId: string;
    needsPayment: boolean;
  }) => void;
};

export function FeedRegisterButton({
  sessionId,
  postId,
  needsName = false,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [askName, setAskName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const register = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await registerForTrainingClient(sessionId, postId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (result.needsPayment) {
          router.push(`/cabinet/pay/${result.registrationId}`);
          return;
        }
        onSuccess({
          registrationId: result.registrationId,
          needsPayment: result.needsPayment,
        });
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setError("Не удалось записаться. Попробуйте ещё раз.");
      }
    });
  };

  return (
    <div>
      <button
        type="button"
        className={`nl-button nl-button--primary${pending ? " nl-button--pending" : ""}`}
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (needsName && !nameSaved) {
            setAskName(true);
            return;
          }
          register();
        }}
      >
        {pending ? (
          <>
            <span className="nl-button__spinner" aria-hidden="true" />
            Запись…
          </>
        ) : (
          "Записаться"
        )}
      </button>
      {error ? (
        <p
          className="caption"
          style={{ color: "var(--cancel)", marginTop: "var(--space-2)" }}
        >
          {error}
        </p>
      ) : null}
      {askName ? (
        <NamePromptDialog
          onClose={() => setAskName(false)}
          onSaved={() => {
            setNameSaved(true);
            setAskName(false);
            register();
          }}
        />
      ) : null}
    </div>
  );
}
