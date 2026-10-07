"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Ширина карточки в ленте: десктоп — колонка ленты при `--content-max: 1280px`
 * (1280 − 2×40 отступы − 320 боковая колонка − 32 зазор); телефон — 390 − 2×16.
 */
export const PREVIEW_CARD_WIDTH = { desktop: 848, mobile: 358 } as const;

/**
 * Рисует содержимое в заданной ширине и пропорционально уменьшает,
 * если колонка уже: раскладка карточки остаётся как в ленте.
 */
export function ScaledPreview({
  width,
  children,
}: {
  width: number;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const update = () => setScale(Math.min(1, outer.clientWidth / width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={outerRef} className="nl-admin-preview">
      <div className="nl-admin-preview__frame" style={{ width, zoom: scale }}>
        {children}
      </div>
      {scale < 1 ? (
        <p className="caption nl-admin-preview__scale">
          Масштаб {Math.round(scale * 100)}%
        </p>
      ) : null}
    </div>
  );
}
