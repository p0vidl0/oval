"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UserMergeLoginDetails } from "@/components/admin/user-merge-login-details";
import type { Paged } from "@/lib/admin/pagination";
import type { AdminUserListRow } from "@/lib/admin/user-queries";

type Props = {
  label: string;
  /** Server action поиска с проверкой прав конкретного экрана. */
  search: (query: string, page: number) => Promise<Paged<AdminUserListRow>>;
  value: AdminUserListRow | null;
  onChange: (user: AdminUserListRow | null) => void;
  excludeUserId?: string | null;
  disabled?: boolean;
  inputTestId?: string;
};

/** Поиск и выбор пользователя (склейка, «пришёл без записи»). */
export function UserPicker({
  label,
  search,
  value,
  onChange,
  excludeUserId,
  disabled,
  inputTestId,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AdminUserListRow[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setLoading(true);
      void search(query, page)
        .then((result) => {
          setItems(
            excludeUserId
              ? result.items.filter((u) => u.id !== excludeUserId)
              : result.items,
          );
          setPageCount(result.pageCount);
          setTotal(result.total);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query, page, excludeUserId, search]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function openSearch() {
    if (disabled || value) return;
    setOpen(true);
    setPage(1);
  }

  function pick(user: AdminUserListRow) {
    onChange(user);
    setOpen(false);
    setQuery("");
    setPage(1);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setPage(1);
  }

  return (
    <div className="nl-admin-user-picker" ref={rootRef}>
      <span className="nl-label">{label}</span>

      {value ? (
        <div className="nl-admin-user-picker__selected">
          <p className="nl-admin-user-picker__name">
            {value.name?.trim() || "—"}
          </p>
          <div className="nl-admin-user-picker__logins">
            <UserMergeLoginDetails
              user={value}
              className="caption nl-admin-user-picker__email"
            />
          </div>
          <p className="caption nl-mono nl-admin-user-picker__id">{value.id}</p>
          <button
            type="button"
            className="nl-button nl-button--text"
            disabled={disabled}
            onClick={clear}
          >
            Изменить
          </button>
        </div>
      ) : (
        <>
          <input
            className="nl-input"
            type="search"
            placeholder="Имя, email или id"
            data-testid={inputTestId}
            value={query}
            disabled={disabled}
            onFocus={openSearch}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
              setOpen(true);
            }}
          />
          {open ? (
            <div
              className="nl-admin-user-picker__panel"
              id={listId}
              role="listbox"
            >
              {loading ? (
                <p className="caption nl-admin-user-picker__empty">Поиск…</p>
              ) : items.length === 0 ? (
                <p className="caption nl-admin-user-picker__empty">
                  {total === 0 ? "Никого не найдено" : "Нет строк на странице"}
                </p>
              ) : (
                <ul className="nl-admin-user-picker__list">
                  {items.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        className="nl-admin-user-picker__option"
                        role="option"
                        onClick={() => pick(user)}
                      >
                        <span className="nl-admin-user-picker__option-name">
                          {user.name?.trim() || "—"}
                        </span>
                        <UserMergeLoginDetails
                          user={user}
                          className="caption nl-admin-user-picker__option-email"
                        />
                        <span className="caption nl-mono nl-admin-user-picker__option-id">
                          {user.id}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pageCount > 1 ? (
                <div className="nl-admin-user-picker__pager">
                  <button
                    type="button"
                    className="nl-button nl-button--sm"
                    disabled={loading || page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </button>
                  <span className="caption">
                    {page} / {pageCount}
                  </span>
                  <button
                    type="button"
                    className="nl-button nl-button--sm"
                    disabled={loading || page >= pageCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Далее
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
