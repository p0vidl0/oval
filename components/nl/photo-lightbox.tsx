"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import type { GalleryImage } from "@/components/nl/photo-gallery";

type Props = {
  images: GalleryImage[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function NlPhotoLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = index !== null && images.length > 0;
  const current = open ? images[index] : null;
  const count = images.length;

  const goPrev = useCallback(() => {
    if (index === null || count <= 1) return;
    onIndexChange((index - 1 + count) % count);
  }, [count, index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index === null || count <= 1) return;
    onIndexChange((index + 1) % count);
  }, [count, index, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goPrev, goNext, onClose]);

  if (!open || !current) return null;

  return (
    <div
      className="nl-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="nl-lightbox__backdrop"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="nl-lightbox__panel">
        <button
          ref={closeRef}
          type="button"
          className="nl-lightbox__close nl-button"
          onClick={onClose}
        >
          Закрыть
        </button>
        {count > 1 ? (
          <>
            <button
              type="button"
              className="nl-lightbox__nav nl-lightbox__nav--prev"
              aria-label="Предыдущее фото"
              onClick={goPrev}
            >
              ‹
            </button>
            <button
              type="button"
              className="nl-lightbox__nav nl-lightbox__nav--next"
              aria-label="Следующее фото"
              onClick={goNext}
            >
              ›
            </button>
          </>
        ) : null}
        <p id={titleId} className="nl-lightbox__counter nl-mono">
          {index + 1} / {count}
        </p>
        <img className="nl-lightbox__img" src={current.src} alt={current.alt} />
      </div>
    </div>
  );
}
