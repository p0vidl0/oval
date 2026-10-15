import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  attachEmailToUser,
  resolveAttachAccount,
  unlinkAuthMethod,
} from "@/lib/auth/link-account";
import {
  sendEmailLinkOtp,
  verifyEmailLinkOtp,
} from "@/lib/auth/link-email-otp";
import { createAccountLinkIntent } from "@/lib/auth/link-intent";
import {
  countAuthMethods,
  listLinkedAuthMethods,
} from "@/lib/auth/linked-accounts";
import {
  confirmProviderLinkMerge,
  processProviderLink,
} from "@/lib/auth/process-provider-link";
import { AUTH_PROVIDER_IDS } from "@/lib/auth/providers";
import { db } from "@/lib/db/client";
import { account, user } from "@/lib/db/schema/auth-schema";
import { insertProviderAccount, insertUser } from "./helpers/auth-seed";
import { useIntegrationDb } from "./helpers/setup";

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

run("auth link and unlink", () => {
  useIntegrationDb();

  it("attachEmailToUser sets email on target", async () => {
    const targetId = await insertUser({ id: "link-email-t", email: null });
    const result = await attachEmailToUser(targetId, "new@oval.local");
    expect(result.action).toBe("attached");

    const linked = await listLinkedAuthMethods(targetId);
    expect(linked.some((m) => m.providerId === "email")).toBe(true);
  });

  it("attachEmailToUser returns merge_required when email belongs to another user", async () => {
    const targetId = await insertUser({ id: "link-email-t2", email: null });
    const otherId = await insertUser({
      id: "link-email-other",
      email: "taken@oval.local",
    });

    const result = await attachEmailToUser(targetId, "taken@oval.local");
    expect(result.action).toBe("merge_required");
    if (result.action === "merge_required") {
      expect(result.sourceUserId).toBe(otherId);
    }
  });

  it("resolveAttachAccount attaches telegram to target", async () => {
    const targetId = await insertUser({ id: "link-tg-t", email: null });
    const result = await resolveAttachAccount({
      targetUserId: targetId,
      providerId: AUTH_PROVIDER_IDS.telegram,
      accountId: "700001",
    });
    expect(result.action).toBe("attached");

    const rows = await db
      .select()
      .from(account)
      .where(eq(account.userId, targetId));
    expect(rows).toHaveLength(1);
  });

  it("resolveAttachAccount returns merge_required when telegram belongs to another user", async () => {
    const targetId = await insertUser({ id: "link-tg-t2", email: null });
    const otherId = await insertUser({ id: "link-tg-other", email: null });
    await insertProviderAccount(otherId, "telegram", "700002");

    const result = await resolveAttachAccount({
      targetUserId: targetId,
      providerId: AUTH_PROVIDER_IDS.telegram,
      accountId: "700002",
    });
    expect(result.action).toBe("merge_required");
    if (result.action === "merge_required") {
      expect(result.sourceUserId).toBe(otherId);
    }
  });

  it("processProviderLink and confirmProviderLinkMerge full self-service flow", async () => {
    const targetId = await insertUser({
      id: "flow-target",
      email: "target-flow@oval.local",
    });
    const sourceId = await insertUser({
      id: "flow-source",
      email: null,
      name: "Flow Source",
    });
    await insertProviderAccount(sourceId, "telegram", "800001");

    const { token } = await createAccountLinkIntent({
      targetUserId: targetId,
      providerId: "telegram",
    });

    const linkResult = await processProviderLink(token, {
      providerId: "telegram",
      accountId: "800001",
      name: "Flow Source",
    });
    expect(linkResult.status).toBe("merge_confirm");
    if (linkResult.status !== "merge_confirm") return;

    const merged = await confirmProviderLinkMerge({
      linkToken: linkResult.linkToken,
      performedByUserId: targetId,
    });
    expect(merged.status).toBe("merged");

    const [source] = await db.select().from(user).where(eq(user.id, sourceId));
    expect(source?.deletedAt).toBeTruthy();

    const accounts = await db
      .select()
      .from(account)
      .where(eq(account.userId, targetId));
    expect(accounts.some((a) => a.accountId === "800001")).toBe(true);
  });

  it("email link OTP verify attaches email", async () => {
    process.env.EMAIL_PROVIDER = "recording";
    const { clearEmailRecordingStore, getLatestEmailOtp } = await import(
      "@/lib/email/recording-store"
    );
    clearEmailRecordingStore();

    const targetId = await insertUser({ id: "otp-target", email: null });
    const { token } = await createAccountLinkIntent({
      targetUserId: targetId,
      providerId: "email",
    });

    const sent = await sendEmailLinkOtp(token, "otp@oval.local");
    expect(sent.ok).toBe(true);

    const wrong = await verifyEmailLinkOtp(token, "000000");
    expect(wrong.ok).toBe(false);

    const code = getLatestEmailOtp("otp@oval.local")?.code;
    expect(code).toBeTruthy();

    const check = await verifyEmailLinkOtp(token, code ?? "");
    expect(check.ok).toBe(true);
    if (!check.ok) return;

    const attach = await processProviderLink(token, {
      providerId: "email",
      accountId: check.email,
      email: check.email,
    });
    expect(attach.status).toBe("attached");

    const [row] = await db.select().from(user).where(eq(user.id, targetId));
    expect(row?.email).toBe("otp@oval.local");
  });

  it("unlinkAuthMethod refuses last method and allows when two exist", async () => {
    const userId = await insertUser({
      id: "unlink-user",
      email: "unlink@oval.local",
    });
    expect(await countAuthMethods(userId)).toBe(1);

    const last = await unlinkAuthMethod({
      userId,
      providerId: AUTH_PROVIDER_IDS.email,
    });
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.reason).toBe("last_method");

    await insertProviderAccount(userId, "telegram", "900300");
    expect(await countAuthMethods(userId)).toBe(2);

    const ok = await unlinkAuthMethod({
      userId,
      providerId: AUTH_PROVIDER_IDS.telegram,
    });
    expect(ok.ok).toBe(true);
    expect(await countAuthMethods(userId)).toBe(1);
  });
});
