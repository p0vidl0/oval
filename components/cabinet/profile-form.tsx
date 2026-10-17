"use client";

import { useActionState, useEffect, useState } from "react";
import {
  type ProfileFormState,
  updateProfileName,
} from "@/lib/cabinet/profile-actions";

const INITIAL_STATE: ProfileFormState = { status: "idle" };
const SAVED_MS = 1800;

export function CabinetProfileForm({
  name,
  email,
  rosterNameVisible,
}: {
  name: string;
  email: string;
  rosterNameVisible: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileName,
    INITIAL_STATE,
  );
  const [seenState, setSeenState] = useState(state);
  const [hideSaved, setHideSaved] = useState(false);
  if (state !== seenState) {
    setSeenState(state);
    setHideSaved(false);
  }

  useEffect(() => {
    if (state.status !== "saved") return;
    const timer = window.setTimeout(() => setHideSaved(true), SAVED_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const showSaved = state.status === "saved" && !pending && !hideSaved;
  const phase = pending ? "pending" : showSaved ? "saved" : "idle";

  return (
    <form
      action={formAction}
      className="nl-field"
      onChange={() => setHideSaved(true)}
    >
      <label className="nl-label" htmlFor="profile-name">
        Имя и фамилия
        <input
          id="profile-name"
          name="name"
          className="nl-input"
          defaultValue={name}
          autoComplete="name"
        />
      </label>
      <p className="nl-field nl-cabinet-profile-card__email">
        <span className="nl-label">
          <span className="nl-show-desktop">Email для входа</span>
          <span className="nl-show-mobile">Email</span>
        </span>
        <span className="nl-input nl-input--mono nl-cabinet-profile-card__email-value">
          {email}
        </span>
      </p>
      <fieldset className="nl-field nl-cabinet-roster-visibility">
        <legend className="nl-label">Имя в списке</legend>
        <div className="nl-segmented">
          <label className="nl-segmented__item">
            <input
              type="radio"
              className="nl-segmented__input"
              name="roster_name_visible"
              value="visible"
              defaultChecked={rosterNameVisible}
            />
            <span className="nl-segmented__text">Отображать</span>
          </label>
          <label className="nl-segmented__item">
            <input
              type="radio"
              className="nl-segmented__input"
              name="roster_name_visible"
              value="hidden"
              defaultChecked={!rosterNameVisible}
            />
            <span className="nl-segmented__text">Скрыть</span>
          </label>
        </div>
        <p className="caption nl-cabinet-roster-visibility__hint">
          Список участников виден на странице анонса.
        </p>
      </fieldset>
      {state.status === "error" ? (
        <p
          className="caption"
          role="alert"
          style={{ color: "var(--cancel)", margin: 0 }}
        >
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        className={`nl-button nl-button--primary nl-button--block${
          pending ? " nl-button--pending" : ""
        }`}
        disabled={pending}
        aria-busy={pending}
      >
        <span
          key={phase}
          className={`nl-button__status${
            phase === "idle" ? "" : " nl-button__status--in"
          }`}
        >
          {pending ? (
            <span className="nl-button__spinner" aria-hidden="true" />
          ) : null}
          {pending ? "Сохраняем…" : showSaved ? "Сохранено" : "Сохранить"}
        </span>
      </button>
    </form>
  );
}
