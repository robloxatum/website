"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Save, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { button, card } from "@/components/ui/styles";
import type { LastEdit } from "@/lib/site-content";
import { formatDateTimeWithYear } from "@/lib/time";

/** "Last edited by <name>, <date>" for a section. */
export function LastEdited({ edit }: { edit: LastEdit }) {
  if (!edit) return <p className="text-sm text-fg-3">Original content. Not edited on the site yet.</p>;
  const when = formatDateTimeWithYear(edit.at);
  return <p className="text-sm text-fg-3">{edit.by ? `Last edited by ${edit.by}, ${when}` : `Last edited ${when}`}</p>;
}

/**
 * One editable section: heading, who edited last, the fields, a Preview of the
 * unsaved changes and Save. `onSubmit` checks the fields first and returns an
 * error to show instead of saving.
 */
export function SectionCard({
  id,
  title,
  description,
  edit,
  error,
  saved,
  pending,
  dirty,
  action,
  hidden,
  check,
  preview,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  edit: LastEdit;
  error?: string;
  saved: boolean;
  pending: boolean;
  dirty: boolean;
  action: (formData: FormData) => void;
  /** Hidden inputs sent with the form. */
  hidden: Record<string, string>;
  check: () => string | null;
  preview: ReactNode;
  children: ReactNode;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const shownError = checkError ?? error;
  return (
    <section aria-labelledby={`${id}-title`} className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-xl text-fg">
          {title}
        </h2>
        <p className="text-sm text-fg-2">{description}</p>
        <LastEdited edit={edit} />
      </div>

      <form
        action={action}
        onSubmit={(e) => {
          const problem = check();
          setCheckError(problem);
          if (problem) e.preventDefault();
        }}
        className="mt-5 space-y-5"
      >
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        {children}

        {showPreview && (
          <div id={`${id}-preview`} className="rounded-2xl border border-dashed border-maize/40 bg-bg/40 p-4 sm:p-5">
            <p className="mb-4 text-xs font-semibold tracking-[0.18em] text-maize uppercase">Preview (not saved yet)</p>
            {preview}
          </div>
        )}

        <div aria-live="polite" className="space-y-3 empty:hidden">
          {shownError && <Alert tone="error" title={shownError} />}
          {!shownError && saved && !dirty && <Alert tone="success" title="Saved. It's live on the site now." />}
        </div>

        <div className="flex flex-col gap-3 border-t border-line/50 pt-5 sm:flex-row sm:items-center">
          <button type="submit" disabled={pending || !dirty} className={button({ size: "lg" })}>
            <Save aria-hidden="true" />
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            aria-expanded={showPreview}
            aria-controls={`${id}-preview`}
            onClick={() => setShowPreview((p) => !p)}
            className={button({ variant: "secondary", size: "lg" })}
          >
            {showPreview ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {showPreview ? "Hide preview" : "Preview"}
          </button>
          {dirty && !pending && <p className="text-sm text-fg-3 sm:ml-auto">Unsaved changes</p>}
        </div>
      </form>
    </section>
  );
}

/** Move up / Move down / Remove for one row of a list. */
export function RowControls({
  name,
  index,
  count,
  onMove,
  onRemove,
}: {
  name: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  const iconButton = button({ variant: "ghost", size: "sm", className: "px-3!" });
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)} className={iconButton} aria-label={`Move ${name} up`}>
        <ArrowUp aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        className={iconButton}
        aria-label={`Move ${name} down`}
      >
        <ArrowDown aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className={`${iconButton} hover:text-bad!`}
        aria-label={`Remove ${name}`}
      >
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  );
}

/** A list with stable React keys for rows that move around. */
export function useKeyedList<T>(initial: T[]) {
  const [state, setState] = useState(() => ({ rows: initial.map((item, key) => ({ key, item })), next: initial.length }));
  const setRows = (fn: (rows: { key: number; item: T }[]) => { key: number; item: T }[]) =>
    setState((s) => ({ ...s, rows: fn(s.rows) }));
  return {
    rows: state.rows,
    items: state.rows.map((r) => r.item),
    update: (index: number, patch: Partial<T>) =>
      setRows((rs) => rs.map((r, i) => (i === index ? { ...r, item: { ...r.item, ...patch } } : r))),
    move: (from: number, to: number) =>
      setRows((rs) => {
        if (to < 0 || to >= rs.length) return rs;
        const copy = [...rs];
        const [row] = copy.splice(from, 1);
        copy.splice(to, 0, row);
        return copy;
      }),
    remove: (index: number) => setRows((rs) => rs.filter((_, i) => i !== index)),
    add: (item: T) => setState((s) => ({ rows: [...s.rows, { key: s.next, item }], next: s.next + 1 })),
  };
}

export function PreviewLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-sm font-semibold text-fg-2">{children}</p>;
}
