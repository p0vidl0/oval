import { describe, expect, it } from "vitest";
import {
  describeRegistrationEvent,
  describeSessionEvent,
} from "@/app/admin/sessions/[id]/describe-events";

describe("describeSessionEvent", () => {
  it("lists changed settings", () => {
    expect(
      describeSessionEvent("updated", {
        changes: { title: {}, priceCents: {}, unknownField: {} },
      }),
    ).toBe("Изменены параметры: название, цена, unknownField");
    expect(describeSessionEvent("updated", {})).toBe("Изменены параметры");
  });

  it("formats reschedule and cancel", () => {
    const label = describeSessionEvent("rescheduled", {
      previousStartsAt: "2026-06-01T14:00:00Z",
      newStartsAt: "2026-06-02T14:00:00Z",
    });
    expect(label).toMatch(/^Перенос: .+ → .+$/);
    expect(label).not.toContain("$");
    expect(describeSessionEvent("cancelled", { reason: "дождь" })).toBe(
      "Отмена: дождь",
    );
    expect(describeSessionEvent("cancelled", {})).toBe("Отмена");
    expect(describeSessionEvent("created", {})).toBe("Тренировка создана");
  });
});

describe("describeRegistrationEvent", () => {
  it.each([
    ["created", {}, "Записался"],
    ["created", { source: "coach" }, "Добавлен тренером"],
    ["cancelled", { cancelledBy: "user" }, "Отменил запись"],
    ["cancelled", { cancelledBy: "admin" }, "Снят клубом"],
    ["payment_succeeded", { source: "webhook" }, "Оплата онлайн"],
    [
      "payment_succeeded",
      { source: "admin_onsite", method: "cash" },
      "Оплачено наличными",
    ],
    [
      "payment_succeeded",
      { source: "admin_onsite", method: "bank_transfer" },
      "Оплачено переводом",
    ],
    ["payment_succeeded", { source: "admin_onsite" }, "Оплачено на месте"],
    ["refunded", {}, "Возврат оплаты"],
    ["transferred_out", {}, "Оплата перенесена на другую тренировку"],
    ["transferred_in", {}, "Оплата перенесена с другой тренировки"],
    ["released", {}, "Снят при отмене тренировки"],
    ["merged", { cancelled: true }, "Склейка аккаунтов, дубль записи снят"],
    ["merged", {}, "Склейка аккаунтов"],
    ["attendance_marked", { from: "unknown", to: "attended" }, "Отмечен: был"],
    [
      "attendance_marked",
      { from: "attended", to: "no_show" },
      "Отметка исправлена: не пришёл",
    ],
    [
      "attendance_marked",
      { from: "unknown", to: "excused" },
      "Отмечен: уважительная",
    ],
  ] as const)("%s %j → %s", (kind, payload, label) => {
    expect(describeRegistrationEvent(kind, payload)).toBe(label);
  });
});
