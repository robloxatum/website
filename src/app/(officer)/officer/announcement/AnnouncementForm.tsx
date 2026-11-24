"use client";

import { Megaphone, Send, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { button, card, field, label } from "@/components/ui/styles";
import { type Announcement, ANNOUNCEMENT_MAX } from "@/lib/announcement";
import { formatDateTime, toClubInputValue } from "@/lib/time";
import { type AnnouncementFormState, saveAnnouncement } from "../actions";

type Current = (Announcement & { created_at: string }) | null;

export function AnnouncementForm({ current }: { current: Current }) {
  const [state, action, pending] = useActionState<AnnouncementFormState, FormData>(saveAnnouncement, {});
  const [message, setMessage] = useState(current?.message ?? "");
  const [style, setStyle] = useState<"info" | "urgent">(current?.style ?? "info");
  const [now] = useState(() => Date.now());
  const expired = !!current?.hide_after && new Date(current.hide_after).getTime() <= now;
  const left = ANNOUNCEMENT_MAX - message.trim().replace(/\s+/g, " ").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <form action={action} className={`${card} space-y-5 p-5 sm:p-6`}>
        {state.error && <Alert tone="error" title={state.error} />}
        {state.published && <Alert tone="success" title="Published. It's showing on the site now." />}
        {state.cleared && <Alert tone="success" title="Cleared. The banner is gone." />}

        <div>
          <label htmlFor="message" className={label}>
            Message
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={3}
            maxLength={ANNOUNCEMENT_MAX + 20}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-describedby="message-count"
            className={`${field} resize-y`}
            placeholder="Game night moved to BBB 1670 tonight"
          />
          <p id="message-count" aria-live="polite" className={`mt-1.5 text-sm ${left < 0 ? "font-semibold text-bad" : "text-fg-3"}`}>
            {left >= 0 ? `${left} characters left` : `${-left} over the ${ANNOUNCEMENT_MAX}-character limit`}
          </p>
        </div>

        <div>
          <label htmlFor="link" className={label}>
            Link <span className="font-normal text-fg-3">(optional)</span>
          </label>
          <input
            id="link"
            name="link"
            inputMode="url"
            defaultValue={current?.link ?? ""}
            className={field}
            placeholder="/events, or a roblox.com / umich.edu link"
            aria-describedby="link-help"
          />
          <p id="link-help" className="mt-1.5 text-sm text-fg-3">
            Our own site, roblox.com or umich.edu. Shown as “Learn more”.
          </p>
        </div>

        <fieldset>
          <legend className={label}>Style</legend>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["info", "Info", "Navy bar"],
                ["urgent", "Urgent", "Maize bar"],
              ] as const
            ).map(([value, name, hint]) => (
              <label
                key={value}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-maize ${
                  style === value ? "border-maize/60 bg-maize/10" : "border-line hover:bg-white/[0.04]"
                }`}
              >
                <input
                  type="radio"
                  name="style"
                  value={value}
                  checked={style === value}
                  onChange={() => setStyle(value)}
                  className="sr-only"
                />
                <span aria-hidden="true" className={`size-4 shrink-0 rounded-full ${value === "urgent" ? "bg-maize" : "border border-line bg-navy"}`} />
                <span>
                  <span className="block font-semibold text-fg">{name}</span>
                  <span className="block text-xs text-fg-3">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="hide_after" className={label}>
            Hide after <span className="font-normal text-fg-3">(optional, Ann Arbor time)</span>
          </label>
          <input
            id="hide_after"
            name="hide_after"
            type="datetime-local"
            defaultValue={current?.hide_after && !expired ? toClubInputValue(current.hide_after) : ""}
            className={field}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" name="intent" value="publish" disabled={pending} className={button({ size: "lg" })}>
            <Send aria-hidden="true" />
            {pending ? "Saving…" : "Publish"}
          </button>
          {current && (
            <button
              type="submit"
              name="intent"
              value="clear"
              formNoValidate
              disabled={pending}
              onClick={(e) => {
                if (!confirm("Clear the announcement? It disappears from the site right away.")) e.preventDefault();
              }}
              className={button({ variant: "secondary", size: "lg" })}
            >
              <Trash2 aria-hidden="true" />
              Clear
            </button>
          )}
        </div>
      </form>

      <aside className="space-y-3">
        <h2 className="text-lg text-fg">Now showing</h2>
        {current ? (
          <div className={`${card} space-y-2 p-4`}>
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                current.style === "urgent" ? "bg-maize text-navy" : "border border-line/60 bg-navy text-fg"
              }`}
            >
              <Megaphone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{current.message}</span>
            </div>
            {current.link && <p className="text-sm break-all text-fg-2">Link: {current.link}</p>}
            <p className="text-sm text-fg-3">
              {expired
                ? `Hidden since ${formatDateTime(current.hide_after!)}.`
                : current.hide_after
                  ? `Hides ${formatDateTime(current.hide_after)}.`
                  : "Shows until you clear it."}
            </p>
          </div>
        ) : (
          <p className={`${card} p-4 text-sm text-fg-3`}>No announcement. The site shows no banner.</p>
        )}
      </aside>
    </div>
  );
}
