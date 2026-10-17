"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema/auth-schema";

export type ProfileFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

export async function updateProfileName(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const session = await getServerSession();
  if (!session) return { status: "error", message: "Войдите заново" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { status: "error", message: "Укажите имя" };
  const rosterNameVisible =
    String(formData.get("roster_name_visible") ?? "visible") !== "hidden";
  await db
    .update(user)
    .set({ name, rosterNameVisible, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
  revalidatePath("/cabinet");
  revalidatePath("/feed", "layout");
  return { status: "saved" };
}

/** Имя перед первой записью на тренировку (окно «Как вас записать?»). */
export async function saveProfileNameClient(
  rawName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: "Войдите заново" };
  const name = rawName.trim().replace(/\s+/g, " ");
  if (name.length < 2) return { ok: false, error: "Укажите имя и фамилию" };
  if (name.length > 80) return { ok: false, error: "Слишком длинное имя" };
  await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
  revalidatePath("/cabinet");
  revalidatePath("/feed");
  return { ok: true };
}
