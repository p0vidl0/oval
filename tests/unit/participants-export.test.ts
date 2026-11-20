import { describe, expect, it } from "vitest";
import {
  participantsCsv,
  participantsExportFilename,
} from "@/lib/admin/participants-export";

describe("participantsCsv", () => {
  it("writes a header and an empty email as a blank cell", () => {
    const csv = participantsCsv([
      { name: "Анна", email: null, attended: 3 },
      { name: "  ", email: "  ", attended: 0 },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1)).toBe("Имя,Email,Посещено\r\nАнна,,3\r\n,,0\r\n");
  });

  it("quotes commas, quotes and line breaks", () => {
    const csv = participantsCsv([
      { name: 'Иванов, "Иван"\nJr', email: "a@b.c", attended: 1 },
    ]);
    expect(csv.slice(1)).toBe(
      'Имя,Email,Посещено\r\n"Иванов, ""Иван""\nJr",a@b.c,1\r\n',
    );
  });

  it("stops Excel from treating a name as a formula", () => {
    const csv = participantsCsv([
      { name: "=1+1", email: "a@b.c", attended: 0 },
    ]);
    expect(csv).toContain("\r\n'=1+1,a@b.c,0\r\n");
  });
});

describe("participantsExportFilename", () => {
  it("uses the club calendar day", () => {
    expect(participantsExportFilename(new Date("2026-11-19T18:30:00Z"))).toBe(
      "participants-2026-11-20.csv",
    );
  });
});
