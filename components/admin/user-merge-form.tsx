"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPicker } from "@/components/admin/user-picker";
import {
  executeAdminUserMerge,
  previewAdminUserMerge,
  searchUsersForMergeAction,
} from "@/lib/admin/merge-users-actions";
import type { AdminUserListRow } from "@/lib/admin/user-queries";
import { can } from "@/lib/auth/capabilities";

export function UserMergeForm() {
  const router = useRouter();
  const [source, setSource] = useState<AdminUserListRow | null>(null);
  const [target, setTarget] = useState<AdminUserListRow | null>(null);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewAdminUserMerge>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!source || !target) return;
    setError(null);
    setPreview(null);
    setLoading(true);
    const result = await previewAdminUserMerge({
      sourceUserId: source.id,
      targetUserId: target.id,
    });
    setLoading(false);
    setPreview(result);
    if (!result.ok) {
      setError(result.message);
    }
  }

  function mergeConfirmMessage(): string {
    if (!preview?.ok) return "";
    const src = preview.source;
    const tgt = preview.target;
    const srcLine = `${src.name}${src.email ? `, ${src.email}` : ""} (${src.id})`;
    const tgtLine = `${tgt.name}${tgt.email ? `, ${tgt.email}` : ""} (${tgt.id})`;
    return (
      `Склеить пользователей?\n\n` +
      `Источник (будет удалён):\n${srcLine}\n\n` +
      `Цель (останется):\n${tgtLine}\n\n` +
      `Записи и способы входа перейдут в цель.`
    );
  }

  async function onMerge() {
    if (!source || !target || !preview?.ok) return;
    if (!window.confirm(mergeConfirmMessage())) return;

    setError(null);
    setLoading(true);
    const result = await executeAdminUserMerge({
      sourceUserId: source.id,
      targetUserId: target.id,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreview(null);
    setSource(null);
    setTarget(null);
    router.refresh();
  }

  function onSourceChange(user: AdminUserListRow | null) {
    setSource(user);
    setPreview(null);
    setError(null);
  }

  function onTargetChange(user: AdminUserListRow | null) {
    setTarget(user);
    setPreview(null);
    setError(null);
  }

  const canPreview = Boolean(source && target && source.id !== target.id);

  return (
    <div className="nl-aside-card">
      <form className="nl-field nl-admin-user-merge-form" onSubmit={onPreview}>
        <UserPicker
          search={searchUsersForMergeAction}
          label="Цель (останется активным)"
          value={target}
          onChange={onTargetChange}
          excludeUserId={source?.id}
          disabled={loading}
          inputTestId="admin-merge-target-search"
        />
        <UserPicker
          search={searchUsersForMergeAction}
          label="Источник (будет помечен удалённым)"
          value={source}
          onChange={onSourceChange}
          excludeUserId={target?.id}
          disabled={loading}
          inputTestId="admin-merge-source-search"
        />
        {source && target && source.id === target.id ? (
          <p className="caption nl-error-text">
            Выберите двух разных пользователей.
          </p>
        ) : null}
        <button
          type="submit"
          className="nl-button nl-button--primary"
          disabled={loading || !canPreview}
          data-testid="admin-merge-preview"
        >
          Проверить
        </button>
      </form>

      {error ? (
        <p className="caption nl-error-text" role="alert">
          {error}
        </p>
      ) : null}

      {preview?.ok ? (
        <div className="nl-field" style={{ marginTop: "var(--space-4)" }}>
          <p className="caption">
            <strong>Источник:</strong> {preview.source.name}
            <br />
            {preview.source.email ?? "Email не указан"}
            <br />
            <span className="nl-mono">{preview.source.id}</span>
          </p>
          <p className="caption">
            <strong>Цель:</strong> {preview.target.name}
            <br />
            {preview.target.email ?? "Email не указан"}
            <br />
            <span className="nl-mono">{preview.target.id}</span>
          </p>
          {can(preview.source.role, "admin.access") ? (
            <p className="caption nl-error-text">
              У источника есть доступ в админку — после склейки он будет
              потерян.
            </p>
          ) : null}
          {preview.paymentConflicts.length > 0 ? (
            <p className="caption nl-error-text">
              Конфликт оплат за одну тренировку (
              {preview.paymentConflicts.length}
              ). Сначала разберите оплаты в разделе «Оплата», затем повторите
              проверку.
            </p>
          ) : (
            <button
              type="button"
              className="nl-button nl-button--primary nl-button--block"
              disabled={loading}
              data-testid="admin-merge-execute"
              onClick={() => void onMerge()}
            >
              Склеить пользователей…
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
