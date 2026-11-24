"use client";

import { Gamepad2, Link2, Trash2, X } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { button, field, label as labelStyle } from "@/components/ui/styles";
import { GAME_LABEL_MAX, GAME_LINK_MAX, type GameLink } from "@/lib/game-links";
import { clearGameLink, setGameLink } from "../actions";

/**
 * Post, replace or clear the event's live game link (a Roblox private server
 * link). Checked-in members see it live while the event is on.
 *
 * `onProjector`: the Present page is on a big screen, so the link is NEVER
 * rendered there. The paste box is masked and the screen only says whether a
 * link is live.
 */
export function GameLinkControl({
  eventId,
  current,
  onProjector = false,
}: {
  eventId: string;
  current: GameLink | null;
  onProjector?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = useId();

  function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    setError(null);
    start(async () => {
      const result = await setGameLink(eventId, String(data.get("url") ?? ""), String(data.get("label") ?? ""));
      if (result.error) return setError(result.error);
      form.reset();
      setEditing(false);
    });
  }

  function clear() {
    if (!window.confirm("Take the game link down? Members will see “Waiting for the game link…” again.")) return;
    setError(null);
    start(async () => {
      const result = await clearGameLink(eventId);
      if (result.error) setError(result.error);
    });
  }

  const status = current ? (
    <p className="inline-flex items-center gap-1.5 rounded-full border border-ok/50 bg-ok/10 px-3 py-1 text-sm font-semibold text-ok">
      <Gamepad2 aria-hidden="true" className="size-4" />
      Game link is live{!onProjector && current.label ? ` · ${current.label}` : ""}
    </p>
  ) : (
    <p className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg-2 px-3 py-1 text-sm font-semibold text-fg-2">
      <Gamepad2 aria-hidden="true" className="size-4" />
      No game link yet
    </p>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status}
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className={button({ variant: "secondary", size: "sm" })}>
            <Link2 aria-hidden="true" />
            {current ? "Replace link" : "Post a link"}
          </button>
        )}
        {current && !editing && (
          <button type="button" onClick={clear} disabled={pending} className={button({ variant: "ghost", size: "sm" })}>
            <Trash2 aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {/* Officers' own view only: the link itself, so they can check it. Never on the projector. */}
      {!onProjector && current && !editing && (
        <p className="truncate text-sm text-fg-3">
          <a href={current.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-2 hover:text-maize">
            {current.url}
          </a>
        </p>
      )}

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
          className="space-y-3 rounded-xl border border-line bg-bg-2/60 p-4 text-left"
        >
          <div>
            <label htmlFor={`${id}-url`} className={labelStyle}>
              Roblox private server link
            </label>
            <input
              id={`${id}-url`}
              name="url"
              required
              maxLength={GAME_LINK_MAX + 20}
              inputMode="url"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://www.roblox.com/share?code=…"
              // On the projector, mask what's pasted so the room never sees the link.
              className={`${field} ${onProjector ? "[-webkit-text-security:disc]" : ""}`}
              aria-describedby={`${id}-help`}
            />
            <p id={`${id}-help`} className="mt-1 text-xs text-fg-3">
              roblox.com links only.{onProjector ? " Hidden on this screen." : ""} Only checked-in members see it, while the event is on.
            </p>
          </div>
          <div>
            <label htmlFor={`${id}-label`} className={labelStyle}>
              Label <span className="font-normal text-fg-3">(optional)</span>
            </label>
            <input
              id={`${id}-label`}
              name="label"
              maxLength={GAME_LABEL_MAX}
              autoComplete="off"
              placeholder="e.g. Server 1 · Obby race"
              defaultValue={current?.label ?? ""}
              className={field}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={button({ size: "sm" })}>
              <Link2 aria-hidden="true" />
              {pending ? "Posting…" : current ? "Replace link" : "Post link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className={button({ variant: "ghost", size: "sm" })}
            >
              <X aria-hidden="true" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
