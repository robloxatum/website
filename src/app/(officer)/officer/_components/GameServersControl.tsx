"use client";

import { ArrowDown, ArrowUp, Ban, CircleCheck, Gamepad2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { button, field, label as labelStyle } from "@/components/ui/styles";
import { GAME_LABEL_MAX, GAME_LINK_MAX, GAME_SERVERS_MAX, defaultServerLabel, type GameServer } from "@/lib/game-links";
import { addGameServer, moveGameServer, removeGameServer, setGameServerFull, updateGameServer } from "../actions";

type Result = Promise<{ error?: string }>;

/**
 * The event's live game servers (Roblox private server links): add several,
 * label them, reorder them, mark one full, edit or remove them. Checked-in
 * members see them live while the event is on.
 *
 * `onProjector`: the Present page is on a big screen, so links are NEVER
 * rendered there. It only gets a count (`summary`) and can add a server with
 * the paste box masked.
 */
export function GameServersControl(
  props:
    | { eventId: string; servers: GameServer[]; onProjector?: false }
    | { eventId: string; onProjector: true; summary: { live: number; full: number } | null },
) {
  const { eventId } = props;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const servers = props.onProjector ? null : props.servers;
  const live = props.onProjector ? (props.summary?.live ?? 0) : props.servers.length;
  const full = props.onProjector ? (props.summary?.full ?? 0) : props.servers.filter((s) => s.is_full).length;
  const atMax = live >= GAME_SERVERS_MAX;

  function run(action: () => Result, after?: () => void) {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.error) return setError(result.error);
      after?.();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill live={live} full={full} />
        {!adding && !atMax && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className={button({ variant: "secondary", size: "sm" })}
          >
            <Plus aria-hidden="true" />
            {live ? "Add a server" : "Post a link"}
          </button>
        )}
        {atMax && <p className="text-sm text-fg-3">That’s the most servers ({GAME_SERVERS_MAX}) for one event.</p>}
      </div>

      {servers && servers.length > 0 && (
        <ol className="divide-y divide-line/50 overflow-hidden rounded-xl border border-line/70" aria-label="Game servers, in the order members see them">
          {servers.map((s, i) =>
            editingId === s.id ? (
              <li key={s.id} className="p-3">
                <ServerForm
                  mode="edit"
                  initial={s}
                  pending={pending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(url, label) => run(() => updateGameServer(s.id, url, label), () => setEditingId(null))}
                />
              </li>
            ) : (
              <li key={s.id} className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center ${s.is_full ? "bg-bg-2/40" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                    <span className="text-fg-3 tabular-nums">{i + 1}.</span>
                    {s.label}
                    {s.is_full ? (
                      <span className="rounded-md border border-bad/40 bg-bad/10 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-bad uppercase">Full</span>
                    ) : (
                      <span className="rounded-md border border-ok/40 bg-ok/10 px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-ok uppercase">Open</span>
                    )}
                  </p>
                  {/* Officers' own view only: the link itself, so they can check it. */}
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm text-fg-3 underline decoration-line underline-offset-2 hover:text-maize"
                  >
                    {s.url}
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <IconButton label={`Move ${s.label} up`} disabled={pending || i === 0} onClick={() => run(() => moveGameServer(eventId, s.id, -1))}>
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    label={`Move ${s.label} down`}
                    disabled={pending || i === servers.length - 1}
                    onClick={() => run(() => moveGameServer(eventId, s.id, 1))}
                  >
                    <ArrowDown />
                  </IconButton>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setGameServerFull(s.id, !s.is_full))}
                    className={button({ variant: "secondary", size: "sm" })}
                  >
                    {s.is_full ? <CircleCheck aria-hidden="true" /> : <Ban aria-hidden="true" />}
                    <span>
                      Mark <span className="sr-only">{s.label} </span>
                      {s.is_full ? "open" : "full"}
                    </span>
                  </button>
                  <IconButton
                    label={`Edit ${s.label}`}
                    disabled={pending}
                    onClick={() => {
                      setEditingId(s.id);
                      setAdding(false);
                    }}
                  >
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label={`Remove ${s.label}`}
                    disabled={pending}
                    onClick={() => {
                      const last = servers.length === 1;
                      const msg = last
                        ? `Take ${s.label} down? It's the only server, so members will see “Waiting for the game link…” again.`
                        : `Take ${s.label} down? Members will no longer see it.`;
                      if (window.confirm(msg)) run(() => removeGameServer(s.id));
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      {adding && (
        <ServerForm
          mode="add"
          masked={props.onProjector}
          placeholderLabel={servers ? defaultServerLabel(servers) : "Server name"}
          pending={pending}
          onCancel={() => setAdding(false)}
          onSubmit={(url, label) => run(() => addGameServer(eventId, url, label), () => setAdding(false))}
        />
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusPill({ live, full }: { live: number; full: number }) {
  if (!live) {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg-2 px-3 py-1 text-sm font-semibold text-fg-2">
        <Gamepad2 aria-hidden="true" className="size-4" />
        No game link yet
      </p>
    );
  }
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full border border-ok/50 bg-ok/10 px-3 py-1 text-sm font-semibold text-ok">
      <Gamepad2 aria-hidden="true" className="size-4" />
      {live === 1 ? "Game link is live" : `${live} servers live`}
      {full > 0 && <span className="text-fg-2"> · {live === 1 ? "full" : `${full} full`}</span>}
    </p>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={button({ variant: "ghost", size: "sm", className: "px-2.5" })}>
      {children}
    </button>
  );
}

function ServerForm({
  mode,
  initial,
  masked = false,
  placeholderLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  mode: "add" | "edit";
  initial?: GameServer;
  masked?: boolean;
  placeholderLabel?: string;
  pending: boolean;
  onSubmit: (url: string, label: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        onSubmit(String(data.get("url") ?? ""), String(data.get("label") ?? ""));
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
          defaultValue={initial?.url}
          placeholder="https://www.roblox.com/share?code=…"
          // On the projector, mask what's pasted so the room never sees the link.
          className={`${field} ${masked ? "[-webkit-text-security:disc]" : ""}`}
          aria-describedby={`${id}-help`}
        />
        <p id={`${id}-help`} className="mt-1 text-xs text-fg-3">
          roblox.com links only.{masked ? " Hidden on this screen." : ""} Only checked-in members see it, while the event is on.
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
          defaultValue={initial?.label}
          placeholder={placeholderLabel ? `${placeholderLabel}, Team Red, Overflow…` : undefined}
          className={field}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={button({ size: "sm" })}>
          {mode === "add" ? <Plus aria-hidden="true" /> : <Pencil aria-hidden="true" />}
          {pending ? "Saving…" : mode === "add" ? "Add server" : "Save server"}
        </button>
        <button type="button" onClick={onCancel} className={button({ variant: "ghost", size: "sm" })}>
          <X aria-hidden="true" />
          Cancel
        </button>
      </div>
    </form>
  );
}
