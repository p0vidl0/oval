/** Подпись полоски мест: пока можно записаться — сколько осталось, иначе только число участников. */
export function occupancyCaption(params: {
  taken: number;
  capacity: number;
  registrationOpen: boolean;
}): { takenLabel: string; leftLabel: string | null } {
  if (!params.registrationOpen) {
    return {
      takenLabel: participantCountLabel(params.taken),
      leftLabel: null,
    };
  }
  const left = Math.max(0, params.capacity - params.taken);
  return {
    takenLabel: `Занято ${params.taken} из ${params.capacity}`,
    leftLabel: `осталось ${left} мест`,
  };
}

function participantCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "участник"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "участника"
        : "участников";
  return `${count} ${word}`;
}
