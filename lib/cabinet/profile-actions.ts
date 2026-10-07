"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getServerSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema/auth-schema";

export async function updateProfileName(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Forbidden");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Укажите имя");
  await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
  revalidatePath("/cabinet");
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
