"use client";

import { type ReactNode, useRef, useState } from "react";

/** Поиск по имени в списке участников: фильтр строк на клиенте, без запроса. */
export function ParticipantsSearch({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  function apply(next: string) {
    setQuery(next);
    const needle = next.trim().toLowerCase();
    for (const row of rootRef.current?.querySelectorAll<HTMLElement>(
      "[data-search]",
    ) ?? []) {
      row.hidden = needle !== "" && !row.dataset.search?.includes(needle);
    }
  }

  return (
    <div ref={rootRef}>
      <input
        className="nl-input nl-participants-search"
        type="search"
        placeholder="Поиск по имени"
        aria-label="Поиск участника"
        value={query}
        onChange={(e) => apply(e.target.value)}
      />
      {children}
    </div>
  );
}
