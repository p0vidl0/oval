export type TrainingRosterEntry = {
  id: string;
  label: string;
};

export function TrainingRoster({
  entries,
  emptyMessage,
}: {
  entries: TrainingRosterEntry[];
  emptyMessage?: string;
}) {
  if (entries.length === 0 && !emptyMessage) return null;

  return (
    <section className="nl-roster" aria-labelledby="training-roster-heading">
      <h2 id="training-roster-heading" className="nl-display nl-roster__title">
        Участники
      </h2>
      {entries.length === 0 ? (
        <p className="caption nl-roster__empty">{emptyMessage}</p>
      ) : (
        <ol className="nl-roster__list">
          {entries.map((entry) => (
            <li key={entry.id} className="nl-roster__item">
              {entry.label}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
