"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { saveProfileNameClient } from "@/lib/cabinet/profile-actions";

/** «Как вас записать?» — имя для списка участников перед первой записью. */
export function NamePromptDialog({
  onSaved,
  onClose,
}: {
  onSaved: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
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
        onClick={onClose}
      />
      <div className="nl-dialog__panel">
        <h2 id={titleId} className="nl-dialog__title">
          Как вас записать?
        </h2>
        <form
          className="nl-dialog__body"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setSaving(true);
            const result = await saveProfileNameClient(name);
            setSaving(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            onSaved();
          }}
        >
          <label className="nl-label" htmlFor={`${titleId}-name`}>
            Имя и фамилия
            <input
              ref={inputRef}
              id={`${titleId}-name`}
              className="nl-input"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </label>
          <p className="caption nl-dialog__note">
            Так вас увидит тренер в списке участников. Изменить можно в
            кабинете.
          </p>
          {error ? (
            <p
              className="caption"
              role="alert"
              style={{ color: "var(--cancel)" }}
            >
              {error}
            </p>
          ) : null}
          <div className="nl-dialog__actions">
            <button
              type="button"
              className="nl-button nl-button--text nl-button--sm"
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="nl-button nl-button--primary nl-button--sm"
              disabled={saving}
            >
              {saving ? "Сохраняем…" : "Записаться"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
