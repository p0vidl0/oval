"use client";

import { useState } from "react";

export function CopyEmailsButton({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);
  if (emails.length === 0) return null;
  return (
    <button
      type="button"
      className="nl-button nl-button--text nl-button--sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(emails.join(", "));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Скопируйте адреса", emails.join(", "));
        }
      }}
    >
      {copied ? "Скопировано" : `Скопировать email’ы (${emails.length})`}
    </button>
  );
}
