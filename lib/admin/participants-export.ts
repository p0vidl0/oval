import { formatDateInput } from "@/lib/format/datetime";

export type ParticipantExportRow = {
  name: string;
  email: string | null;
  attended: number;
};

/**
 * Точка с запятой: на русской macOS Excel считает разделителем её, а не запятую,
 * и складывает всю строку в одну колонку. `sep=;` — подсказка Excel, чтобы
 * Windows с UTF-8 BOM не вернулся к запятой.
 */
const DELIMITER = ";";

/** Excel воспринимает ячейку как формулу, если она начинается с одного из этих символов. */
const FORMULA_PREFIX = /^[=+\-@]/;

function csvCell(value: string): string {
  let text = value;
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

/** UTF-8 с BOM и CRLF, чтобы Excel открыл кириллицу. */
export function participantsCsv(rows: ParticipantExportRow[]): string {
  const lines = ["sep=;", "Имя;Email;Посещено"];
  for (const row of rows) {
    lines.push(
      [
        csvCell(row.name.trim()),
        csvCell(row.email?.trim() ?? ""),
        String(row.attended),
      ].join(DELIMITER),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function participantsExportFilename(now: Date): string {
  return `participants-${formatDateInput(now)}.csv`;
}
