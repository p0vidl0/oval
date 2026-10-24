"use client";

import { useOptimistic, useState, useTransition } from "react";
import { markAttendanceAction } from "@/lib/admin/attendance-actions";
import type { Attendance } from "@/lib/domain/attendance/rules";

type Choice = "attended" | "no_show";

const CHOICES: { value: Choice; label: string; modifier: string }[] = [
  { value: "attended", label: "Был", modifier: "yes" },
  { value: "no_show", label: "Не был", modifier: "no" },
];

/**
 * «Был» / «Не был» под палец. Отметка подсвечивается сразу (оптимистично),
 * нажатая кнопка показывает спиннер до ответа сервера (`button-feedback.mdc`),
 * при ошибке отметка откатывается и под кнопками появляется текст.
 */
export function AttendanceButtons({
  registrationId,
  value,
}: {
  registrationId: string;
  value: Attendance;
}) {
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [sending, setSending] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function mark(next: Choice) {
    if (pending || next === optimistic) return;
    setError(null);
    setSending(next);
    startTransition(async () => {
      setOptimistic(next);
      const result = await markAttendanceAction({
        registrationId,
        value: next,
      });
      if (result.status === "error") setError(result.message);
      setSending(null);
    });
  }

  return (
    <div className="nl-attendance" aria-busy={pending}>
      <div className="nl-attendance__buttons">
        {CHOICES.map((choice) => {
          const pressed = optimistic === choice.value;
          const busy = pending && sending === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              className={`nl-button nl-button--sm nl-attendance__button nl-attendance__button--${choice.modifier}${
                busy ? " nl-button--pending" : ""
              }`}
              aria-pressed={pressed}
              aria-busy={busy}
              disabled={pending}
              onClick={() => mark(choice.value)}
            >
              {/* key по состоянию — заново проигрывает проявление подписи. */}
              <span
                key={`${pressed}-${busy}`}
                className={`nl-button__status${pressed || busy ? " nl-button__status--in" : ""}`}
              >
                {busy ? (
                  <span className="nl-button__spinner" aria-hidden="true" />
                ) : null}
                {choice.label}
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="caption nl-error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
