import { type AppRole, parseRole } from "@/lib/auth/roles";

/**
 * Права проверяются по возможностям, а не по ролям. Новая роль — это набор
 * нужных возможностей в `ROLE_CAPABILITIES`.
 */
export const CAPABILITIES = [
  /** Вход в `/admin` и ссылка «Админ» в шапке. */
  "admin.access",
  /** Создать, изменить, перенести, отменить тренировку. */
  "sessions.manage",
  "feed.publish",
  /** Снять участника, «Оплачено на месте». */
  "registrations.manage",
  /** Возврат и перенос оплаты, по одной записи и массово. */
  "payments.refund",
  /** Ручное подтверждение mock-оплаты. */
  "payments.confirmMock",
  "analytics.view",
  /** Отметки посещения в окне (до 3 дней после тренировки). */
  "attendance.mark",
  /** Отметки и исправления после окна. */
  "attendance.markLate",
  "users.manageRoles",
  "users.merge",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const STAFF: readonly Capability[] = [
  "admin.access",
  "sessions.manage",
  "feed.publish",
  "registrations.manage",
  "payments.refund",
  "payments.confirmMock",
  "analytics.view",
  "attendance.mark",
];

const USER_ADMIN: readonly Capability[] = [
  "users.manageRoles",
  "users.merge",
  "attendance.markLate",
];

const ROLE_CAPABILITIES: Record<AppRole, ReadonlySet<Capability>> = {
  user: new Set(),
  admin: new Set(STAFF),
  super_admin: new Set([...STAFF, ...USER_ADMIN]),
};

export function can(
  role: string | null | undefined,
  capability: Capability,
): boolean {
  return ROLE_CAPABILITIES[parseRole(role)].has(capability);
}
