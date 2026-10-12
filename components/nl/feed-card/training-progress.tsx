import Link from "next/link";
import type { FeedCardTraining } from "@/components/nl/feed-card/types";

export function FeedCardTrainingProgress({
  training,
  href,
}: {
  training: FeedCardTraining;
  href?: string;
}) {
  const capacity = training.capacity;
  if (!training.registrationEnabled || capacity === null) return null;

  const taken = training.activeCount ?? 0;
  const left = Math.max(0, capacity - taken);
  const fillPct = capacity > 0 ? Math.min(100, (taken / capacity) * 100) : 0;

  const row = (
    <>
      <span>
        Занято {taken} из {capacity}
      </span>
      <span className="nl-progress__left">осталось {left} мест</span>
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
