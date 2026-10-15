import type { AdminUserListRow } from "@/lib/admin/user-queries";
import { providerLabel } from "@/lib/auth/providers";

type Props = {
  user: AdminUserListRow;
  className?: string;
};

/** Email или строки provider · account_id для дропдауна склейки. */
export function UserMergeLoginDetails({ user, className }: Props) {
  const email = user.email?.trim();
  if (email) {
    return <span className={className}>{email}</span>;
  }

  if (user.accounts.length === 0) {
    return <span className={className}>—</span>;
  }

  return (
    <>
      {user.accounts.map((acc) => (
        <span key={`${acc.providerId}-${acc.accountId}`} className={className}>
          {providerLabel(acc.providerId)} ·{" "}
          <span className="nl-mono">{acc.accountId}</span>
        </span>
      ))}
    </>
  );
}
