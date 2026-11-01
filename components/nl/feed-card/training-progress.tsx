import Link from "next/link";
import { occupancyCaption } from "@/components/nl/feed-card/occupancy-caption";
import type { FeedCardTraining } from "@/components/nl/feed-card/types";

export function FeedCardTrainingProgress({
  training,
  href,
  registrationOpen,
}: {
  training: FeedCardTraining;
  href?: string;
  /** Кнопка «Записаться» на карточке. Пока её нет, «осталось N мест» не показываем. */
  registrationOpen: boolean;
}) {
  const capacity = training.capacity;
  if (!training.registrationEnabled || capacity === null) return null;

  const taken = training.activeCount ?? 0;
  const fillPct = capacity > 0 ? Math.min(100, (taken / capacity) * 100) : 0;
  const caption = occupancyCaption({ taken, capacity, registrationOpen });

  const row = (
    <>
      <span>{caption.takenLabel}</span>
      {caption.leftLabel ? (
        <span className="nl-progress__left">{caption.leftLabel}</span>
      ) : null}
    </>
  );

  return (
    <div className="nl-progress">
      {href ? (
        <Link href={href} className="nl-progress__row nl-progress__row--link">
          {row}
        </Link>
      ) : (
        <div className="nl-progress__row">{row}</div>
      )}
      <div className="nl-progress__track">
        <div className="nl-progress__fill" style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  );
}
