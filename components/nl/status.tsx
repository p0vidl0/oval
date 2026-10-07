import type { ReactNode } from "react";

type Variant = "default" | "due" | "cancelled" | "draft";

type Props = {
  variant?: Variant;
  children: ReactNode;
  /** Show checkmark instead of dot (paid state) */
  paid?: boolean;
};

export function NlStatus({ variant = "default", children, paid }: Props) {
  const variantClass =
    variant === "due"
      ? " nl-status--due"
      : variant === "cancelled"
        ? " nl-status--cancelled"
        : variant === "draft"
          ? " nl-status--draft"
          : "";

  return (
    <span className={`nl-status${variantClass}`.trim()}>
      {paid ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <span className="nl-status__dot" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
