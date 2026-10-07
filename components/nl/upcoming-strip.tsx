import Link from "next/link";
import { formatShortListDate, formatTimeHm } from "@/lib/format/datetime";

export type UpcomingItem = {
  sessionId: string;
  href: string;
  startsAt: Date;
  title: string;
  status: string;
  /** mine — пользователь записан; open — запись открыта. */
  tone: "mine" | "open" | "muted";
};

/** Телефон: ближайшие тренировки горизонтальной лентой над публикациями. */
export function UpcomingStrip({ items }: { items: UpcomingItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="nl-upcoming" aria-label="Ближайшие тренировки">
      <h2 className="nl-label">Ближайшие</h2>
      <ul className="nl-upcoming__list">
        {items.map((item) => (
          <li key={item.sessionId}>
            <Link
              href={item.href}
              className={`nl-upcoming__item nl-upcoming__item--${item.tone}`}
            >
              <span className="nl-mono data-sm">
                {formatShortListDate(item.startsAt)}
                <br />
                {formatTimeHm(item.startsAt)}
              </span>
              <span className="nl-upcoming__title">{item.title}</span>
              <span className="nl-upcoming__status">{item.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
