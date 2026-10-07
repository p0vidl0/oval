import Link from "next/link";
import { type FilterOption, FilterSelect } from "@/components/nl/filter-select";

/** Фильтр-навигация: чипы на десктопе, выпадающий список на телефоне. */
export function FilterNav({
  options,
  value,
  label,
}: {
  options: FilterOption[];
  /** `href` выбранного варианта. */
  value: string;
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <div className="nl-show-desktop">
        <div className="nl-chip-row">
          {options.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              className="nl-chip"
              aria-pressed={o.href === value}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="nl-show-mobile">
        <FilterSelect options={options} value={value} label={label} />
      </div>
    </nav>
  );
}
