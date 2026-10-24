"use client";

import { useState, useTransition } from "react";
import { AdminDialog, DialogActions } from "@/components/admin/admin-dialog";
import { UserPicker } from "@/components/admin/user-picker";
import {
  addWalkInAction,
  searchUsersForWalkInAction,
} from "@/lib/admin/attendance-actions";
import type { AdminUserListRow } from "@/lib/admin/user-queries";

/** «Пришёл без записи»: участник добавляется сразу как пришедший, мимо лимита. */
export function WalkInDialog({ sessionId }: { sessionId: string }) {
  return (
    <AdminDialog
      title="Пришёл без записи"
      triggerLabel="Пришёл без записи…"
      triggerClassName="nl-button nl-button--sm"
    >
      {(close) => <WalkInForm sessionId={sessionId} onDone={close} />}
    </AdminDialog>
  );
}

function WalkInForm({
  sessionId,
  onDone,
}: {
  sessionId: string;
  onDone: () => void;
}) {
  const [user, setUser] = useState<AdminUserListRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="nl-dialog__body"
      onSubmit={(e) => {
        e.preventDefault();
        if (!user) return;
        setError(null);
        startTransition(async () => {
          const result = await addWalkInAction({ sessionId, userId: user.id });
          if (result.status === "error") setError(result.message);
          else onDone();
        });
      }}
    >
      <UserPicker
        label="Участник"
        search={searchUsersForWalkInAction}
        value={user}
        onChange={setUser}
        disabled={pending}
      />
      <p className="caption nl-dialog__note">
        Запись создаётся сразу с отметкой «Был», лимит мест не учитывается.
        Оплату отметьте отдельно.
      </p>
      {error ? (
        <p className="caption nl-error-text" role="alert">
          {error}
        </p>
      ) : null}
      <DialogActions
        onCancel={onDone}
        submitLabel={pending ? "Добавляем…" : "Добавить"}
      />
    </form>
  );
}
