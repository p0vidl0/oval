import type { FeedCardTraining } from "@/components/nl/feed-card/types";

export function FeedCardTrainingProgress({
  training,
}: {
  training: FeedCardTraining;
}) {
  const capacity = training.capacity;
  if (!training.registrationEnabled || capacity === null) return null;

  const taken = training.activeCount ?? 0;
  const left = Math.max(0, capacity - taken);
  const fillPct = capacity > 0 ? Math.min(100, (taken / capacity) * 100) : 0;

  return (
    <div className="nl-progress">
      <div className="nl-progress__row">
        <span>
          Занято {taken} из {capacity}
        </span>
        <span className="nl-progress__left">осталось {left} мест</span>
      </div>
      <div className="nl-progress__track">
        <div className="nl-progress__fill" style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  );
}
