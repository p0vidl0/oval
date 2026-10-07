import { formatDateStackParts } from "@/lib/format/datetime";

type Props = {
  date: Date | string;
  size?: "sm" | "md" | "lg";
  cancelled?: boolean;
};

export function NlDateStack({ date, size = "md", cancelled }: Props) {
  const { dow, day, month } = formatDateStackParts(date);
  const sizeClass =
    size === "lg"
      ? "nl-datestack--lg"
      : size === "sm"
        ? "nl-datestack--sm"
        : "";
  return (
    <div
      className={`nl-datestack ${sizeClass}${cancelled ? " nl-datestack--cancelled" : ""}`.trim()}
      aria-hidden={false}
    >
      <span className="nl-datestack__dow">{dow}</span>
      <span className="nl-datestack__day">{day}</span>
      <span className="nl-datestack__month">{month}</span>
    </div>
  );
}
