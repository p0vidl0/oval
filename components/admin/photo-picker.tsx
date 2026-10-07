"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/components/nl/photo-gallery";

/** Как в `lib/uploads/storage.ts`: сервер проверит то же самое. */
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export type ExistingPhoto = { id: string; src: string; alt: string };

type Pending = { key: string; file: File; src: string };

type Props = {
  existing: ExistingPhoto[];
  maxImages: number;
  /** Новые фото для превью карточки (вызывается при любом изменении). */
  onChange: (pending: GalleryImage[]) => void;
};

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

/**
 * Фото публикации: перетаскивание, выбор, вставка из буфера, превью плитками.
 * Форма получает те же поля, что раньше: `images` (новые файлы) и
 * `remove_image_ids` (снятые с поста; удаление мягкое, `removed_at`).
 */
export function PhotoPicker({ existing, maxImages, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const single = maxImages === 1;

  const kept = existing.filter((p) => !removed.has(p.id));
  const free = Math.max(0, maxImages - kept.length - pending.length);

  // Файлы — в настоящий <input name="images">, превью — редактору.
  // `removed` в зависимостях намеренно: после снятия фото редактор перечитывает
  // скрытые поля `remove_image_ids` и обновляет превью карточки.
  // biome-ignore lint/correctness/useExhaustiveDependencies: см. комментарий выше
  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      const dt = new DataTransfer();
      for (const p of pending) dt.items.add(p.file);
      input.files = dt.files;
    }
    onChange(pending.map((p) => ({ src: p.src, alt: p.file.name })));
  }, [pending, removed, onChange]);

  // Освобождаем object URL при уходе со страницы.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(
    () => () => {
      for (const p of pendingRef.current) URL.revokeObjectURL(p.src);
    },
    [],
  );

  const addFiles = useCallback(
    (files: Iterable<File>) => {
      const list = [...files].filter((f) => f.size > 0);
      if (list.length === 0) return;
      const problems: string[] = [];
      const valid = list.filter((f) => {
        if (!ACCEPT.includes(f.type)) {
          problems.push(`${f.name}: подходят JPEG, PNG или WebP`);
          return false;
        }
        if (f.size > MAX_BYTES) {
          problems.push(`${f.name}: больше 5 МБ`);
          return false;
        }
        return true;
      });

      if (single) {
        // Одно фото: новое заменяет текущее.
        const file = valid[0];
        if (file) {
          for (const p of pending) URL.revokeObjectURL(p.src);
          setPending([
            { key: crypto.randomUUID(), file, src: URL.createObjectURL(file) },
          ]);
          setRemoved(new Set(existing.map((p) => p.id)));
        }
        setErrors(problems);
        return;
      }

      const room = Math.max(0, maxImages - kept.length - pending.length);
      const accepted = valid.slice(0, room);
      if (valid.length > room) {
        problems.push(`Не больше ${maxImages} фото — лишние не добавлены`);
      }
      setPending((prev) => [
        ...prev,
        ...accepted.map((file) => ({
          key: crypto.randomUUID(),
          file,
          src: URL.createObjectURL(file),
        })),
      ]);
      setErrors(problems);
    },
    [single, existing, pending, kept.length, maxImages],
  );

  // Вставка скриншота из буфера (Ctrl/Cmd+V), текст не трогаем.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length === 0) return;
      e.preventDefault();
      addFiles(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const removePending = (key: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.key === key);
      if (item) URL.revokeObjectURL(item.src);
      return prev.filter((p) => p.key !== key);
    });
    setErrors([]);
  };

  const toggleExisting = (id: string) => {
    const restoring = removed.has(id);
    if (restoring && single && pending.length > 0) {
      // Одно фото: вернуть старое вместо выбранного нового.
      for (const p of pending) URL.revokeObjectURL(p.src);
      setPending([]);
    }
    setRemoved((prev) => {
      const next = new Set(prev);
      if (restoring) next.delete(id);
      else next.add(id);
      return next;
    });
    setErrors([]);
  };

  const openPicker = () => inputRef.current?.click();

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
  };

  const dropzone = (
    <button
      type="button"
      className={`nl-photo-drop${dragging ? " nl-photo-drop--active" : ""}${single ? " nl-photo-drop--wide" : ""}`}
      onClick={openPicker}
      {...dropProps}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
      {single ? (
        <>
          <span className="nl-photo-drop__title">
            Перетащите фото или нажмите, чтобы выбрать
          </span>
          <span className="nl-photo-drop__hint">
            JPEG, PNG, WebP · до 5 МБ · можно вставить из буфера
          </span>
        </>
      ) : (
        <span className="nl-photo-drop__title">Добавить</span>
      )}
    </button>
  );

  const hiddenFields = (
    <>
      <input
        ref={inputRef}
        type="file"
        name="images"
        accept={ACCEPT.join(",")}
        multiple={!single}
        hidden
        onChange={(e) => {
          const picked = [...(e.target.files ?? [])];
          // Выбор заменяет input.files: сразу возвращаем принятые файлы,
          // чтобы отклонённые (тип/размер) не ушли на сервер.
          const dt = new DataTransfer();
          for (const p of pending) dt.items.add(p.file);
          e.target.files = dt.files;
          addFiles(picked);
        }}
      />
      {[...removed].map((id) => (
        <input
          key={id}
          type="checkbox"
          name="remove_image_ids"
          value={id}
          checked
          readOnly
          hidden
        />
      ))}
    </>
  );

  const errorList =
    errors.length > 0 ? (
      <ul className="nl-photo-errors" role="alert">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    ) : null;

  if (single) {
    const newPhoto = pending[0];
    const current = existing[0];
    const showCurrent = !newPhoto && current && !removed.has(current.id);
    return (
      <fieldset className="nl-photo-picker">
        <legend className="nl-label">Фото</legend>
        {hiddenFields}
        {newPhoto || showCurrent ? (
          <div className="nl-photo-single" {...dropProps}>
            <img
              src={newPhoto ? newPhoto.src : current?.src}
              alt={newPhoto ? newPhoto.file.name : (current?.alt ?? "")}
              className="nl-photo-single__img"
            />
            <div className="nl-photo-single__bar">
              <span className="nl-photo-single__name">
                {newPhoto
                  ? `${newPhoto.file.name} · ${formatSize(newPhoto.file.size)}`
                  : "Текущее фото"}
              </span>
              <button
                type="button"
                className="nl-button nl-button--text nl-button--sm"
                onClick={openPicker}
              >
                Заменить
              </button>
              <button
                type="button"
                className="nl-photo-remove"
                aria-label="Убрать фото"
                onClick={() => {
                  if (newPhoto) removePending(newPhoto.key);
                  else if (current) toggleExisting(current.id);
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          dropzone
        )}
        {current && removed.has(current.id) && !newPhoto ? (
          <p className="caption nl-photo-note">
            Текущее фото уберём при сохранении.{" "}
            <button
              type="button"
              className="nl-button nl-button--text nl-button--sm"
              onClick={() => toggleExisting(current.id)}
            >
              Вернуть
            </button>
          </p>
        ) : null}
        {errorList}
      </fieldset>
    );
  }

  const firstKeptId = kept[0]?.id;
  return (
    <fieldset className="nl-photo-picker" {...dropProps}>
      <legend className="nl-label">Фото</legend>
      {hiddenFields}
      <ul className="nl-photo-grid">
        {existing.map((p) => {
          const isRemoved = removed.has(p.id);
          return (
            <li
              key={p.id}
              className={`nl-photo-tile${isRemoved ? " nl-photo-tile--removed" : ""}`}
            >
              <img src={p.src} alt={p.alt} />
              {p.id === firstKeptId ? (
                <span className="nl-photo-tile__tag">Обложка</span>
              ) : null}
              {isRemoved ? (
                <button
                  type="button"
                  className="nl-photo-tile__restore"
                  onClick={() => toggleExisting(p.id)}
                  disabled={free === 0}
                >
                  Вернуть
                </button>
              ) : (
                <button
                  type="button"
                  className="nl-photo-remove"
                  aria-label="Убрать фото"
                  onClick={() => toggleExisting(p.id)}
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
        {pending.map((p, i) => (
          <li key={p.key} className="nl-photo-tile">
            <img src={p.src} alt={p.file.name} />
            <span className="nl-photo-tile__tag nl-photo-tile__tag--new">
              {!firstKeptId && i === 0 ? "Обложка · новое" : "Новое"}
            </span>
            <button
              type="button"
              className="nl-photo-remove"
              aria-label={`Убрать ${p.file.name}`}
              onClick={() => removePending(p.key)}
            >
              ✕
            </button>
          </li>
        ))}
        {free > 0 ? (
          <li className="nl-photo-tile nl-photo-tile--add">{dropzone}</li>
        ) : null}
      </ul>
      <p className="caption nl-photo-note">
        {kept.length + pending.length} из {maxImages} · JPEG, PNG, WebP до 5 МБ
        · можно перетащить или вставить из буфера
      </p>
      {errorList}
    </fieldset>
  );
}
