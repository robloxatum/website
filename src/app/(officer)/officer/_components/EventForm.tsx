"use client";

import { useActionState, useRef } from "react";
import { Alert } from "@/components/ui/Alert";
import { button, card, field, label } from "@/components/ui/styles";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/categories";
import type { EventCategory } from "@/lib/types";
import { saveEvent, type EventFormState } from "../actions";

type Defaults = {
  id?: string;
  title?: string;
  location?: string;
  description?: string;
  starts_at?: string; // "YYYY-MM-DDTHH:mm" in club time
  ends_at?: string;
  category?: EventCategory;
  capacity?: number | null;
};

function plusHours(local: string, hours: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + hours, +m[5]));
  return d.toISOString().slice(0, 16);
}

export function EventForm({ defaults = {} }: { defaults?: Defaults }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(saveEvent, {});
  const endsRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className={`${card} space-y-5 p-5 sm:p-6`}>
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div>
        <label htmlFor="title" className={label}>Title</label>
        <input id="title" name="title" required maxLength={120} defaultValue={defaults.title} className={field} placeholder="Scripting Workshop: Tweens" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={label}>Category</label>
          <select id="category" name="category" defaultValue={defaults.category ?? "meeting"} className={field}>
            {CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>{CATEGORIES[key].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="capacity" className={label}>
            Capacity <span className="font-normal text-fg-3">(optional)</span>
          </label>
          <input
            id="capacity"
            name="capacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            step={1}
            defaultValue={defaults.capacity ?? ""}
            className={field}
            placeholder="e.g. 120"
            aria-describedby="capacity-help"
          />
          <p id="capacity-help" className="mt-1 text-xs text-fg-3">Shows a progress bar for officers. Never shown publicly.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="starts_at" className={label}>Starts</label>
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={defaults.starts_at}
            className={field}
            onChange={(e) => {
              if (endsRef.current && !endsRef.current.value) {
                endsRef.current.value = plusHours(e.target.value, 2);
              }
            }}
          />
        </div>
        <div>
          <label htmlFor="ends_at" className={label}>Ends</label>
          <input ref={endsRef} id="ends_at" name="ends_at" type="datetime-local" required defaultValue={defaults.ends_at} className={field} />
        </div>
      </div>
      <p className="-mt-2 text-sm text-fg-2">
        Ann Arbor time. Check-in closes automatically at the end time; you can reopen it.
      </p>

      <div>
        <label htmlFor="location" className={label}>Location</label>
        <input id="location" name="location" maxLength={200} defaultValue={defaults.location} className={field} placeholder="BBB 1670" />
      </div>

      <div>
        <label htmlFor="description" className={label}>Description</label>
        <textarea id="description" name="description" rows={5} maxLength={5000} defaultValue={defaults.description} className={field} placeholder="What are we doing? Bring a laptop?" />
      </div>

      {state.error && <Alert tone="error" title={state.error} />}

      <button type="submit" disabled={pending} className={button({ size: "lg", className: "w-full sm:w-auto" })}>
        {pending ? "Saving…" : defaults.id ? "Save changes" : "Create event"}
      </button>
    </form>
  );
}
