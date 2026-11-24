"use client";

import { useActionState, useRef } from "react";
import { Alert } from "@/components/ui/Alert";
import { button, card, field, label } from "@/components/ui/styles";
import { CATEGORIES, CATEGORY_KEYS } from "@/lib/categories";
import { FLYER_BUCKET, FLYER_MAX_DIMENSION, FLYER_TYPES, type Flyer, flyerFileError } from "@/lib/flyers";
import { createClient } from "@/lib/supabase/client";
import type { EventCategory } from "@/lib/types";
import { saveEvent, type EventFormState } from "../actions";
import { FlyerField } from "./FlyerField";

type Defaults = {
  id?: string;
  title?: string;
  location?: string;
  description?: string;
  starts_at?: string; // "YYYY-MM-DDTHH:mm" in club time
  ends_at?: string;
  category?: EventCategory;
  capacity?: number | null;
  flyer?: Flyer | null;
};

/**
 * Uploads a chosen flyer straight from the browser to Storage (officer RLS; the
 * bucket enforces PNG/JPEG and 5 MB), then hands only its name and size to
 * saveEvent, so the file never passes through a server action.
 */
async function saveWithFlyer(prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const file = formData.get("flyer_file");
  formData.delete("flyer_file");
  if (!(file instanceof File) || file.size === 0) return saveEvent(prev, formData);

  const problem = flyerFileError(file);
  if (problem) return { error: problem };
  let width: number, height: number;
  try {
    const bitmap = await createImageBitmap(file);
    ({ width, height } = bitmap);
    bitmap.close();
  } catch {
    return { error: "That file isn't a readable PNG or JPG image." };
  }
  if (width > FLYER_MAX_DIMENSION || height > FLYER_MAX_DIMENSION) return { error: "That image is too large (20,000 px max per side)." };

  const path = `${crypto.randomUUID()}.${FLYER_TYPES[file.type]}`;
  const storage = createClient().storage.from(FLYER_BUCKET);
  // Each flyer gets a new name, so it can be cached for a year.
  const { error } = await storage.upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return { error: "Couldn't upload the flyer. Check your connection and try again." };

  formData.set("flyer_action", "replace");
  formData.set("flyer_path", path);
  formData.set("flyer_width", String(width));
  formData.set("flyer_height", String(height));
  const result = await saveEvent(prev, formData); // redirects on success
  if (result?.error) await storage.remove([path]); // not saved: don't leave the file behind
  return result;
}

function plusHours(local: string, hours: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + hours, +m[5]));
  return d.toISOString().slice(0, 16);
}

export function EventForm({ defaults = {} }: { defaults?: Defaults }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(saveWithFlyer, {});
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

      <FlyerField current={defaults.flyer ?? null} title={defaults.title} />

      {state.error && <Alert tone="error" title={state.error} />}

      <button type="submit" disabled={pending} className={button({ size: "lg", className: "w-full sm:w-auto" })}>
        {pending ? "Saving…" : defaults.id ? "Save changes" : "Create event"}
      </button>
    </form>
  );
}
