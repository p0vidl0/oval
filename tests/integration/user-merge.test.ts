import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { findMergePaymentConflicts, mergeUsers } from "@/lib/auth/merge-users";
import { db } from "@/lib/db/client";
import {
  payments,
  registrationEvents,
  registrations,
  userMerges,
} from "@/lib/db/schema";
import { account, session, user } from "@/lib/db/schema/auth-schema";
import { listPublicRoster } from "@/lib/training/registrations";
import {
  insertAuthSession,
  insertPayment,
  insertProviderAccount,
  insertUser,
} from "./helpers/auth-seed";
import {
  seedPendingPayment,
  seedPublishedAnnouncement,
  seedRegistration,
} from "./helpers/seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("user merge", () => {
  useIntegrationDb();

  it("merges source into target: tombstone, sessions, accounts, registrations", async () => {
    const targetId = await insertUser({
      id: "merge-target",
      email: "target@oval.local",
      name: "Target User",
    });
    const sourceId = await insertUser({
      id: "merge-source",
      email: null,
      name: "Source User",
    });
    await insertProviderAccount(sourceId, "telegram", "900100");
    await insertAuthSession(sourceId, "source-session-token");

    const { sessionId } = await seedPublishedAnnouncement({
      sessionId: crypto.randomUUID(),
      postId: crypto.randomUUID(),
    });
    const sourceRegId = await seedRegistration(sourceId, sessionId, "paid");

    const mergeId = await mergeUsers({
      sourceUserId: sourceId,
      targetUserId: targetId,
      performedByUserId: targetId,
      kind: "self_link",
      selfService: true,
    });

    const [sourceRow] = await db
      .select()
      .from(user)
      .where(eq(user.id, sourceId));
    expect(sourceRow?.deletedAt).toBeTruthy();
    expect(sourceRow?.mergedIntoUserId).toBe(targetId);
    expect(sourceRow?.email).toBeNull();

    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, sourceId));
    expect(sessions).toHaveLength(0);

    const accounts = await db
      .select()
      .from(account)
      .where(eq(account.userId, targetId));
    expect(accounts.some((a) => a.providerId === "telegram")).toBe(true);

    const [reg] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, sourceRegId));
    expect(reg?.userId).toBe(targetId);

    const [journal] = await db
      .select()
      .from(userMerges)
      .where(eq(userMerges.id, mergeId));
    expect(journal?.sourceUserId).toBe(sourceId);
    expect(journal?.targetUserId).toBe(targetId);
    expect(journal?.kind).toBe("self_link");
    expect(journal?.snapshot?.movedRegistrationIds).toContain(sourceRegId);
  });

  it("refuses merge when both have blocking payments for same session", async () => {
    const targetId = await insertUser({ id: "pay-target" });
    const sourceId = await insertUser({ id: "pay-source" });
    const { sessionId } = await seedPublishedAnnouncement({
      sessionId: crypto.randomUUID(),
      postId: crypto.randomUUID(),
    });
    const targetReg = await seedRegistration(targetId, sessionId, "due");
    const sourceReg = await seedRegistration(sourceId, sessionId, "due");
    await seedPendingPayment(targetId, targetReg, 1000);
    await seedPendingPayment(sourceId, sourceReg, 1000);

    await expect(
      mergeUsers({
        sourceUserId: sourceId,
        targetUserId: targetId,
        performedByUserId: targetId,
        kind: "self_link",
        selfService: true,
      }),
    ).rejects.toMatchObject({ code: "payment_conflict" });

    expect(await findMergePaymentConflicts(sourceId, targetId)).toHaveLength(1);
  });

  it("allows merge when only one side has a blocking payment on duplicate session", async () => {
    const targetId = await insertUser({ id: "one-pay-target" });
    const sourceId = await insertUser({ id: "one-pay-source" });
    const { sessionId } = await seedPublishedAnnouncement({
      sessionId: crypto.randomUUID(),
      postId: crypto.randomUUID(),
    });
    const targetReg = await seedRegistration(targetId, sessionId, "due");
    await seedRegistration(sourceId, sessionId, "due");
    await seedPendingPayment(targetId, targetReg, 1000);

    expect(await findMergePaymentConflicts(sourceId, targetId)).toHaveLength(0);

    await mergeUsers({
      sourceUserId: sourceId,
      targetUserId: targetId,
      performedByUserId: targetId,
      kind: "self_link",
      selfService: true,
    });
  });

  it("duplicate session: keeps stronger source registration and cancels target active reg", async () => {
    const targetId = await insertUser({ id: "dup-target" });
    const sourceId = await insertUser({ id: "dup-source", email: null });
    const { sessionId } = await seedPublishedAnnouncement({
      sessionId: crypto.randomUUID(),
      postId: crypto.randomUUID(),
    });
    const targetRegId = await seedRegistration(targetId, sessionId, "due");
    const sourceRegId = await seedRegistration(sourceId, sessionId, "paid");

    await mergeUsers({
      sourceUserId: sourceId,
      targetUserId: targetId,
      performedByUserId: targetId,
      kind: "self_link",
      selfService: true,
    });

    // Запись источника переезжает к цели целиком (вместе с платежом),
    // дубль цели снимается клубом.
    const [kept] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, sourceRegId));
    expect(kept).toMatchObject({
      userId: targetId,
      status: "active",
      paymentState: "paid",
    });

    const [cancelled] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, targetRegId));
    expect(cancelled).toMatchObject({
      userId: targetId,
      status: "cancelled",
      cancelledBy: "admin",
    });

    const events = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.kind, "merged"));
    expect(events).toHaveLength(2);
  });

  it("duplicate session: keeps target registration when target is stronger", async () => {
    const targetId = await insertUser({ id: "dup2-target" });
    const sourceId = await insertUser({ id: "dup2-source", email: null });
    const { sessionId } = await seedPublishedAnnouncement({
      sessionId: crypto.randomUUID(),
      postId: crypto.randomUUID(),
    });
    const targetRegId = await seedRegistration(targetId, sessionId, "paid");
    const sourceRegId = await seedRegistration(sourceId, sessionId, "due");

    await mergeUsers({
      sourceUserId: sourceId,
      targetUserId: targetId,
      performedByUserId: targetId,
      kind: "self_link",
      selfService: true,
    });

    const [targetReg] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, targetRegId));
    expect(targetReg).toMatchObject({
      userId: targetId,
      status: "active",
      paymentState: "paid",
    });

    const [sourceReg] = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, sourceRegId));
    expect(sourceReg).toMatchObject({ userId: targetId, status: "cancelled" });
  });

  it("closed registrations on the same session move without conflict", async () => {
    const targetId = await insertUser({ id: "closed-target" });
    const sourceId = await insertUser({ id: "closed-source", email: null });
    const { sessionId } = await seedPublishedAnnouncement({
      sessionId: crypto.randomUUID(),
      postId: crypto.randomUUID(),
    });
    const targetRegId = await seedRegistration(targetId, sessionId, "paid");
    const sourceRegId = await seedRegistration(
      sourceId,
      sessionId,
      "refunded",
      "cancelled",
    );

    await mergeUsers({
      sourceUserId: sourceId,
      targetUserId: targetId,
      performedByUserId: targetId,
      kind: "self_link",
      selfService: true,
    });

    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.userId, targetId));
    expect(rows.map((r) => r.id).sort()).toEqual(
      [sourceRegId, targetRegId].sort(),
    );
    const [kept] = rows.filter((r) => r.id === targetRegId);
    expect(kept?.status).toBe("active");
  });

  it("transfers payments user_id to target", async () => {
    const targetId = await insertUser({ id: "pay-move-target" });
    const sourceId = await insertUser({ id: "pay-move-source", email: null });
    const { sessionId } = await seedPublishedAnnouncement({
      sessionId: crypto.randomUUID(),
      postId: crypto.randomUUID(),
    });
    const sourceReg = await seedRegistration(sourceId, sessionId, "paid");
    const paymentId = await insertPayment(
      sourceId,
      sourceReg,
      "succeeded",
      5000,
    );

    await mergeUsers({
      sourceUserId: sourceId,
      targetUserId: targetId,
      performedByUserId: targetId,
      kind: "super_admin",
      selfService: false,
    });

    const [pay] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId));
    expect(pay?.userId).toBe(targetId);
  });

  it("copies source email to target when target has none", async () => {
    const targetId = await insertUser({
      id: "email-target",
      email: null,
      name: "Target",
    });
    const sourceId = await insertUser({
      id: "email-source",
      email: "source@oval.local",
      name: "Source",
    });

    await mergeUsers({
      sourceUserId: sourceId,
      targetUserId: targetId,
      performedByUserId: targetId,
      kind: "self_link",
      selfService: true,
    });

    const [target] = await db.select().from(user).where(eq(user.id, targetId));
    expect(target?.email).toBe("source@oval.local");
  });

  it("keeps target email when both have email", async () => {
    const targetId = await insertUser({
      id: "email2-target",
      email: "keep@oval.local",
    });
    const sourceId = await insertUser({
      id: "email2-source",
      email: "lose@oval.local",
    });

    await mergeUsers({
      sourceUserId: sourceId,
      targetUserId: targetId,
      performedByUserId: targetId,
      kind: "self_link",
      selfService: true,
    });

    const [target] = await db.select().from(user).where(eq(user.id, targetId));
    expect(target?.email).toBe("keep@oval.local");
  });

  it("rejects merging user with self", async () => {
    const id = await insertUser({ id: "self-merge" });
    await expect(
      mergeUsers({
        sourceUserId: id,
        targetUserId: id,
        performedByUserId: id,
        kind: "self_link",
        selfService: true,
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects deleted source or target", async () => {
    const targetId = await insertUser({ id: "live-target" });
    const deletedSource = await insertUser({
      id: "deleted-source",
      deletedAt: new Date(),
    });

    await expect(
      mergeUsers({
        sourceUserId: deletedSource,
        targetUserId: targetId,
        performedByUserId: targetId,
        kind: "super_admin",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("self-service rejects staff and banned source", async () => {
    const targetId = await insertUser({ id: "self-tgt" });
    const adminSource = await insertUser({
      id: "admin-src",
      role: "admin",
      email: null,
    });
    await insertProviderAccount(adminSource, "telegram", "1");

    await expect(
      mergeUsers({
        sourceUserId: adminSource,
        targetUserId: targetId,
        performedByUserId: targetId,
        kind: "self_link",
        selfService: true,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const bannedSource = await insertUser({
      id: "banned-src",
      banned: true,
      email: null,
    });
    await insertProviderAccount(bannedSource, "telegram", "2");

    await expect(
      mergeUsers({
        sourceUserId: bannedSource,
        targetUserId: targetId,
        performedByUserId: targetId,
        kind: "self_link",
        selfService: true,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects super_admin as source even for admin merge", async () => {
    const targetId = await insertUser({ id: "sa-target" });
    const superSource = await insertUser({
      id: "sa-source",
      role: "super_admin",
    });

    await expect(
      mergeUsers({
        sourceUserId: superSource,
        targetUserId: targetId,
        performedByUserId: targetId,
        kind: "super_admin",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("super_admin merge can merge admin source (selfService off)", async () => {
    const targetId = await insertUser({ id: "admin-merge-target" });
    const sourceId = await insertUser({
      id: "admin-merge-source",
      role: "admin",
      email: null,
    });
    await insertProviderAccount(sourceId, "telegram", "900200");

    await mergeUsers({
      sourceUserId: sourceId,
      targetUserId: targetId,
      performedByUserId: targetId,
      kind: "super_admin",
      selfService: false,
    });

    const [source] = await db.select().from(user).where(eq(user.id, sourceId));
    expect(source?.deletedAt).toBeTruthy();
  });

  it("roster lists merged participant under target, not deleted source", async () => {
    const targetId = await insertUser({
      id: "roster-target",
      name: "Roster Target",
    });
    const sourceId = await insertUser({
      id: "roster-source",
      email: null,
      name: "Roster Source",
    });
    const { sessionId } = await seedPublishedAnnouncement({
      sessionId: crypto.randomUUID(),
      postId: crypto.randomUUID(),
    });
    await seedRegistration(sourceId, sessionId, "paid");

    await mergeUsers({
      sourceUserId: sourceId,
      targetUserId: targetId,
      performedByUserId: targetId,
      kind: "self_link",
      selfService: true,
    });

    const roster = await listPublicRoster(sessionId);
    expect(roster.some((r) => r.label.includes("Roster Target"))).toBe(true);
    expect(roster.some((r) => r.label.includes("Roster Source"))).toBe(false);
  });
});
