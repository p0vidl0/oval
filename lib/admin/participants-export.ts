import { formatDateInput } from "@/lib/format/datetime";

export type ParticipantExportRow = {
  name: string;
  email: string | null;
  attended: number;
};

/** Excel воспринимает ячейку как формулу, если она начинается с одного из этих символов. */
const FORMULA_PREFIX = /^[=+\-@]/;

function csvCell(value: string): string {
  let text = value;
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** UTF-8 с BOM и CRLF, чтобы Excel открыл кириллицу. */
export function participantsCsv(rows: ParticipantExportRow[]): string {
  const lines = ["Имя,Email,Посещено"];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.name.trim()),
        csvCell(row.email?.trim() ?? ""),
        String(row.attended),
      ].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function participantsExportFilename(now: Date): string {
  return `participants-${formatDateInput(now)}.csv`;
}
