"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { setUserRoleAction } from "@/lib/admin/user-role-actions";
import {
  ASSIGNABLE_ROLES,
  type AssignableRole,
} from "@/lib/auth/assignable-roles";
import { roleLabel } from "@/lib/auth/role-labels";
import { parseRole } from "@/lib/auth/roles";

const SAVED_MS = 2000;

type Props = {
  userId: string;
  currentRole: string | null;
};

export function AdminUserRolePicker({ userId, currentRole }: Props) {
  const parsed = parseRole(currentRole);
  if (parsed === "super_admin") {
    return <span className="caption">{roleLabel(parsed)}</span>;
  }

  const initial = (
    ASSIGNABLE_ROLES.includes(parsed as AssignableRole) ? parsed : "user"
  ) as AssignableRole;

  return <AdminUserRolePickerForm userId={userId} initialRole={initial} />;
}

function AdminUserRolePickerForm({
  userId,
  initialRole,
}: {
  userId: string;
  initialRole: AssignableRole;
}) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(initialRole);
  const [role, setRole] = useState<AssignableRole>(initialRole);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBaseline(initialRole);
    setRole(initialRole);
  }, [initialRole]);

  const dirty = role !== baseline;

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), SAVED_MS);
    return () => window.clearTimeout(timer);
  }, [saved]);

  async function onSave() {
    if (!dirty || pending) return;
    const label = roleLabel(role);
    if (!window.confirm(`Назначить роль «${label}»?`)) return;

    setPending(true);
    setError(null);
    setSaved(false);
    const result = await setUserRoleAction({ userId, role });
    setPending(false);

    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setBaseline(role);
    setSaved(true);
    router.refresh();
  }

  const phase = pending ? "pending" : saved && !dirty ? "saved" : "idle";
  const buttonLabel =
    phase === "pending"
      ? "Сохраняем…"
      : phase === "saved"
        ? "Сохранено"
        : "Сохранить";

  return (
    <div className="nl-admin-user-role">
      <select
        className="nl-input nl-admin-user-role__select"
        value={role}
        disabled={pending}
        aria-label="Роль пользователя"
        onChange={(e) => {
          setRole(e.target.value as AssignableRole);
          setSaved(false);
          setError(null);
        }}
      >
        {ASSIGNABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={`nl-button nl-button--sm${pending ? " nl-button--pending" : ""}`}
        disabled={!dirty || pending}
        aria-busy={pending}
        onClick={() => void onSave()}
      >
        {pending ? <span className="nl-button__spinner" aria-hidden /> : null}
        <span
          className={
            phase === "saved" ? "nl-button__status nl-button__status--in" : ""
          }
        >
          {buttonLabel}
        </span>
      </button>
      {error ? (
        <p className="caption" role="alert" style={{ color: "var(--cancel)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
