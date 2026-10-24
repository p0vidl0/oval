import { and, eq, inArray, sql } from "drizzle-orm";
import { parseRole } from "@/lib/auth/roles";
import { isUserDeleted } from "@/lib/auth/user-active";
import { db } from "@/lib/db/client";
import {
  payments,
  registrations,
  type UserMergeSnapshot,
  userMerges,
} from "@/lib/db/schema";
import { account, session, user } from "@/lib/db/schema/auth-schema";
import { insertRegistrationEvents } from "@/lib/domain/registration/events";

export class MergeUsersError extends Error {
  constructor(
    message: string,
    readonly code: "forbidden" | "not_found" | "payment_conflict" | "invalid",
  ) {
    super(message);
    this.name = "MergeUsersError";
  }
}

export type MergeUsersKind = "self_link" | "super_admin";

export type MergePaymentConflict = {
  trainingSessionId: string;
  sourceRegistrationId: string;
  targetRegistrationId: string;
};

const BLOCKING_PAYMENT_STATUSES = ["pending", "succeeded"] as const;

type RegRow = typeof registrations.$inferSelect;
type PayRow = typeof payments.$inferSelect;

/** Какую из двух активных записей на одну тренировку оставить. */
function regScore(reg: RegRow, pay: PayRow | undefined): number {
  if (pay?.status === "succeeded") return 4;
  if (pay?.status === "pending") return 3;
  if (reg.paymentState === "paid") return 2;
  return 1;
}

/** Активные записи пользователя по тренировке (частичный unique: не больше одной). */
function activeBySession(rows: RegRow[]) {
  return new Map(
    rows
      .filter((row) => row.status === "active")
      .map((row) => [row.trainingSessionId, row]),
  );
}

export async function findMergePaymentConflicts(
  sourceUserId: string,
  targetUserId: string,
): Promise<MergePaymentConflict[]> {
  const [sourceRegs, targetRegs] = await Promise.all([
    db
      .select()
      .from(registrations)
      .where(eq(registrations.userId, sourceUserId)),
    db
      .select()
      .from(registrations)
      .where(eq(registrations.userId, targetUserId)),
  ]);

  const targetBySession = activeBySession(targetRegs);
  const conflicts: MergePaymentConflict[] = [];

  for (const sourceReg of sourceRegs) {
    if (sourceReg.status !== "active") continue;
    const targetReg = targetBySession.get(sourceReg.trainingSessionId);
    if (!targetReg) continue;

    const regIds = [sourceReg.id, targetReg.id];
    const payRows = await db
      .select()
      .from(payments)
      .where(
        and(
          inArray(payments.registrationId, regIds),
          inArray(payments.status, [...BLOCKING_PAYMENT_STATUSES]),
        ),
      );

    const sourcePay = payRows.find((p) => p.registrationId === sourceReg.id);
    const targetPay = payRows.find((p) => p.registrationId === targetReg.id);
    if (sourcePay && targetPay) {
      conflicts.push({
        trainingSessionId: sourceReg.trainingSessionId,
        sourceRegistrationId: sourceReg.id,
        targetRegistrationId: targetReg.id,
      });
    }
  }

  return conflicts;
}

export type MergeUsersInput = {
  sourceUserId: string;
  targetUserId: string;
  performedByUserId: string;
  kind: MergeUsersKind;
  /** Self-service link: source must be role `user`, not banned, not deleted. */
  selfService?: boolean;
};

export async function mergeUsers(input: MergeUsersInput): Promise<string> {
  if (input.sourceUserId === input.targetUserId) {
    throw new MergeUsersError(
      "Нельзя склеить пользователя с самим собой",
      "invalid",
    );
  }

  const conflicts = await findMergePaymentConflicts(
    input.sourceUserId,
    input.targetUserId,
  );
  if (conflicts.length > 0) {
    throw new MergeUsersError(
      "У обоих аккаунтов есть оплата за одну тренировку. Обратитесь к администратору.",
      "payment_conflict",
    );
  }

  const mergeId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id FROM "user"
      WHERE id = ${input.sourceUserId} OR id = ${input.targetUserId}
      FOR UPDATE
    `);

    const rows = await tx
      .select()
      .from(user)
      .where(inArray(user.id, [input.sourceUserId, input.targetUserId]));
    const source = rows.find((r) => r.id === input.sourceUserId);
    const target = rows.find((r) => r.id === input.targetUserId);
    if (!source || !target) {
      throw new MergeUsersError("Пользователь не найден", "not_found");
    }
    if (isUserDeleted(target)) {
      throw new MergeUsersError("Целевой пользователь недоступен", "invalid");
    }
    if (isUserDeleted(source)) {
      throw new MergeUsersError("Исходный пользователь уже удалён", "invalid");
    }

    if (input.selfService) {
      if (parseRole(source.role) !== "user") {
        throw new MergeUsersError(
          "Нельзя объединить аккаунт с правами администратора",
          "forbidden",
        );
      }
      if (source.banned) {
        throw new MergeUsersError(
          "Нельзя объединить заблокированный аккаунт",
          "forbidden",
        );
      }
    }

    if (parseRole(source.role) === "super_admin") {
      throw new MergeUsersError(
        "Нельзя использовать супер-админа как источник",
        "forbidden",
      );
    }

    const snapshot: UserMergeSnapshot = {
      sourceEmail: source.email,
      movedAccountIds: [],
      movedRegistrationIds: [],
      movedPaymentIds: [],
      cancelledRegistrationIds: [],
    };

    const sourceRegs = await tx
      .select()
      .from(registrations)
      .where(eq(registrations.userId, source.id));
    const targetRegs = await tx
      .select()
      .from(registrations)
      .where(eq(registrations.userId, target.id));
    const targetBySession = activeBySession(targetRegs);

    const allRegIds = [
      ...sourceRegs.map((r) => r.id),
      ...targetRegs.map((r) => r.id),
    ];
    const payByRegId = new Map<string, PayRow>();
    if (allRegIds.length > 0) {
      const payRows = await tx
        .select()
        .from(payments)
        .where(inArray(payments.registrationId, allRegIds));
      for (const pay of payRows) {
        payByRegId.set(pay.registrationId, pay);
      }
    }

    // Закрытые записи переезжают к цели всегда. Коллизия возможна только
    // между двумя активными записями на одну тренировку: остаётся сильнейшая,
    // вторая снимается клубом (строка с её платежом не меняется).
    const mergeEvent = (reg: RegRow, cancelled: boolean) => ({
      registrationId: reg.id,
      sessionId: reg.trainingSessionId,
      kind: "merged" as const,
      payload: { fromUserId: source.id, toUserId: target.id, cancelled },
      actorUserId: input.performedByUserId,
    });
    const moveToTarget = async (reg: RegRow) => {
      await tx
        .update(registrations)
        .set({ userId: target.id, updatedAt: new Date() })
        .where(eq(registrations.id, reg.id));
      snapshot.movedRegistrationIds?.push(reg.id);
    };
    const cancelByMerge = async (reg: RegRow) => {
      await tx
        .update(registrations)
        .set({
          status: "cancelled",
          cancelledBy: "admin",
          updatedAt: new Date(),
        })
        .where(eq(registrations.id, reg.id));
      snapshot.cancelledRegistrationIds?.push(reg.id);
    };

    for (const sourceReg of sourceRegs) {
      const targetReg =
        sourceReg.status === "active"
          ? targetBySession.get(sourceReg.trainingSessionId)
          : undefined;
      if (!targetReg) {
        await moveToTarget(sourceReg);
        await insertRegistrationEvents(tx, [mergeEvent(sourceReg, false)]);
        continue;
      }

      const keepSource =
        regScore(sourceReg, payByRegId.get(sourceReg.id)) >
        regScore(targetReg, payByRegId.get(targetReg.id));
      const dropped = keepSource ? targetReg : sourceReg;
      await cancelByMerge(dropped);
      await moveToTarget(sourceReg);
      await insertRegistrationEvents(tx, [
        mergeEvent(sourceReg, !keepSource),
        ...(keepSource ? [mergeEvent(targetReg, true)] : []),
      ]);
    }

    const sourcePayments = await tx
      .select()
      .from(payments)
      .where(eq(payments.userId, source.id));
    for (const pay of sourcePayments) {
      await tx
        .update(payments)
        .set({ userId: target.id, updatedAt: new Date() })
        .where(eq(payments.id, pay.id));
      snapshot.movedPaymentIds?.push(pay.id);
    }

    const sourceAccounts = await tx
      .select()
      .from(account)
      .where(eq(account.userId, source.id));
    for (const acc of sourceAccounts) {
      await tx
        .update(account)
        .set({ userId: target.id, updatedAt: new Date() })
        .where(eq(account.id, acc.id));
      snapshot.movedAccountIds?.push(acc.id);
    }

    const targetPatch: Partial<typeof user.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (!target.name?.trim() && source.name?.trim()) {
      targetPatch.name = source.name;
    }
    if (!target.image?.trim() && source.image?.trim()) {
      targetPatch.image = source.image;
    }
    if (!target.email?.trim() && source.email?.trim()) {
      targetPatch.email = source.email;
      targetPatch.emailVerified = source.emailVerified;
      await tx
        .update(user)
        .set({
          email: null,
          emailVerified: false,
          updatedAt: new Date(),
        })
        .where(eq(user.id, source.id));
    }
    if (!target.phoneNumber?.trim() && source.phoneNumber?.trim()) {
      targetPatch.phoneNumber = source.phoneNumber;
      targetPatch.phoneNumberVerified = source.phoneNumberVerified;
      await tx
        .update(user)
        .set({
          phoneNumber: null,
          phoneNumberVerified: null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, source.id));
    }
    await tx.update(user).set(targetPatch).where(eq(user.id, target.id));

    await tx.delete(session).where(eq(session.userId, source.id));

    await tx
      .update(user)
      .set({
        deletedAt: new Date(),
        mergedIntoUserId: target.id,
        email: null,
        emailVerified: false,
        phoneNumber: null,
        phoneNumberVerified: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, source.id));

    await tx.insert(userMerges).values({
      id: mergeId,
      sourceUserId: source.id,
      targetUserId: target.id,
      performedByUserId: input.performedByUserId,
      kind: input.kind,
      snapshot,
    });
  });

  return mergeId;
}
