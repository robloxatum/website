"use client";

import { useState, useTransition } from "react";
import { button } from "@/components/ui/styles";

/** A button that runs a server action, optionally after a confirm() prompt. */
export function ActionButton({
  action,
  confirmText,
  className = button({ variant: "secondary", size: "sm" }),
  children,
}: {
  action: () => Promise<{ error?: string } | void>;
  confirmText?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            const res = await action();
            if (res && res.error) setError(res.error);
          });
        }}
      >
        {pending ? "…" : children}
      </button>
      {error && (
        <span role="alert" className="max-w-64 text-xs font-semibold text-bad">
          {error}
        </span>
      )}
    </span>
  );
}
