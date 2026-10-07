"use client";

import { useRouter } from "next/navigation";

export type FilterOption = { href: string; label: string };

/** Выпадающий список фильтра: выбор — переход по ссылке варианта. */
export function FilterSelect({
  options,
  value,
  label,
}: {
  options: FilterOption[];
  /** `href` выбранного варианта. */
  value: string;
  label: string;
}) {
  const router = useRouter();
  return (
    <select
      className="nl-input nl-filter-select"
      aria-label={label}
      value={value}
      onChange={(e) => router.push(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.href} value={o.href}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
