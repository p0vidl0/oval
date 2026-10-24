import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addWalkInAction,
  markAttendanceAction,
  markRestNoShowAction,
  searchUsersForWalkInAction,
} from "@/lib/admin/attendance-actions";
import {
  adminMarkPaidForm,
  adminMarkRefundedForm,
  adminRemoveRegistrationForm,
} from "@/lib/admin/registration-actions";
import { setUserRoleAction } from "@/lib/admin/user-role-actions";
import { db } from "@/lib/db/client";
import { payments, registrations, user } from "@/lib/db/schema";
import { cancelRegistrationForm } from "@/lib/training/cancel-action";
import {
  seedPublishedAnnouncement,
  seedRegistration,
  seedUser,
} from "./helpers/seed";
import { useIntegrationDb } from "./helpers/setup";

/** Сессию подменяем: server actions проверяют права через getServerSession. */
const auth = vi.hoisted(() => ({
  current: null as null | { user: { id: string; role: string; name: string } },
}));

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

vi.mock("@/lib/auth/session", () => ({
  getServerSession: vi.fn(async () => auth.current),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

const run = process.env.OVAL_INTEGRATION === "1" ? describe : describe.skip;

async function signIn(role: "user" | "admin" | "super_admin", id: string) {
  await seedUser(id);
  await db.update(user).set({ role }).where(eq(user.id, id));
  auth.current = { user: { id, role, name: id } };
  return id;
}

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function redirectOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("expected a redirect");
}

async function reg(id: string) {
  const [row] = await db
    .select()
    .from(registrations)
    .where(eq(registrations.id, id));
  return row;
}

run("server actions: capabilities", () => {
  useIntegrationDb();

  beforeEach(() => {
    auth.current = null;
  });

  async function startedRegistration(paymentState: "due" | "paid" = "due") {
    const { sessionId } = await seedPublishedAnnouncement({
      startsAt: new Date(Date.now() - 30 * 60_000),
      capacity: 5,
    });
    const regId = await seedRegistration(
      await seedUser(`participant-${crypto.randomUUID().slice(0, 6)}`),
      sessionId,
      paymentState,
    );
    return { sessionId, regId };
  }

  it("participant and guest cannot use admin actions", async () => {
    const { sessionId, regId } = await startedRegistration();
    for (const actor of [null, "user"] as const) {
      if (actor) await signIn(actor, "plain-user");
      else auth.current = null;
      await expect(
        markAttendanceAction({ registrationId: regId, value: "attended" }),
      ).rejects.toThrow("Forbidden");
      await expect(markRestNoShowAction({ sessionId })).rejects.toThrow(
        "Forbidden",
      );
      await expect(
        addWalkInAction({ sessionId, userId: "plain-user" }),
      ).rejects.toThrow("Forbidden");
      await expect(searchUsersForWalkInAction("a", 1)).rejects.toThrow(
        "Forbidden",
      );
      await expect(
        adminMarkPaidForm(
          form({
            registration_id: regId,
            session_id: sessionId,
            method: "cash",
          }),
        ),
      ).rejects.toThrow("Forbidden");
      await expect(
        adminRemoveRegistrationForm(form({ registration_id: regId })),
      ).rejects.toThrow("Forbidden");
      await expect(
        adminMarkRefundedForm(form({ registration_id: regId })),
      ).rejects.toThrow("Forbidden");
    }
    expect(await reg(regId)).toMatchObject({
      status: "active",
      paymentState: "due",
      attendance: "unknown",
    });
  });

  it("admin marks attendance; the action returns a result instead of throwing", async () => {
    const { regId } = await startedRegistration();
    await signIn("admin", "action-admin");
    expect(
      await markAttendanceAction({ registrationId: regId, value: "attended" }),
    ).toEqual({ status: "ok", changed: 1 });
    expect(
      await markAttendanceAction({ registrationId: regId, value: "unknown" }),
    ).toEqual({ status: "error", message: "Неизвестная отметка" });
    expect((await reg(regId))?.attendanceMarkedBy).toBe("action-admin");
  });

  it("«Оплачено» requires a method and stores it", async () => {
    const { sessionId, regId } = await startedRegistration();
    await signIn("admin", "pay-admin");
    await expect(
      adminMarkPaidForm(
        form({ registration_id: regId, session_id: sessionId }),
      ),
    ).rejects.toThrow("Выберите способ оплаты");
    expect((await reg(regId))?.paymentState).toBe("due");

    await adminMarkPaidForm(
      form({
        registration_id: regId,
        session_id: sessionId,
        method: "bank_transfer",
      }),
    );
    expect((await reg(regId))?.paymentState).toBe("paid");
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.registrationId, regId));
    expect(payment?.method).toBe("bank_transfer");
  });

  it("participant form keeps participant rules even for an admin", async () => {
    const { sessionId } = await seedPublishedAnnouncement({
      startsAt: new Date(Date.now() + 24 * 3600_000),
      capacity: 5,
    });
    const otherReg = await seedRegistration(
      await seedUser("form-other"),
      sessionId,
    );
    const adminId = await signIn("admin", "form-admin");
    const ownPaid = await seedRegistration(adminId, sessionId, "paid");

    const foreign = await redirectOf(() =>
      cancelRegistrationForm(
        form({ registration_id: otherReg, return_to: "/cabinet" }),
      ),
    );
    expect(decodeURIComponent(foreign)).toContain("error=Forbidden");
    expect((await reg(otherReg))?.status).toBe("active");

    const paid = await redirectOf(() =>
      cancelRegistrationForm(
        form({ registration_id: ownPaid, return_to: "/cabinet" }),
      ),
    );
    expect(paid).toContain("error=");
    expect((await reg(ownPaid))?.status).toBe("active");
  });

  it("admin cannot manage roles; super_admin can", async () => {
    const target = await seedUser("role-target");
    await signIn("admin", "role-admin");
    await expect(
      setUserRoleAction({ userId: target, role: "admin" }),
    ).rejects.toThrow("Forbidden");
    await signIn("super_admin", "role-super");
    expect(await setUserRoleAction({ userId: target, role: "admin" })).toEqual({
      status: "ok",
    });
  });
});
