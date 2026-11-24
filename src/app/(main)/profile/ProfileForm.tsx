"use client";

import { CircleCheck, Pencil, Search } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { button, card, field, label } from "@/components/ui/styles";
import { previewRobloxUser, type ProfileFormState, type RobloxPreview, saveProfile } from "./actions";

const norm = (v: string) => v.trim().replace(/^@/, "").toLowerCase();

export function ProfileForm({
  mode,
  next = "/",
  uniqname,
  fullName,
  robloxUsername,
}: {
  mode: "welcome" | "edit";
  next?: string;
  uniqname: string;
  fullName: string;
  robloxUsername: string | null;
}) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [roblox, setRoblox] = useState(robloxUsername ?? "");
  // The username the member has confirmed ("Yes, that's me" or "Save anyway"),
  // or the one already saved. Saving a different one asks first.
  const [confirmed, setConfirmed] = useState(norm(robloxUsername ?? ""));
  const [preview, setPreview] = useState<{ for: string; result: RobloxPreview } | null>(null);
  const [checking, startCheck] = useTransition();

  const needsCheck = norm(roblox) !== "" && norm(roblox) !== confirmed;
  const shownPreview = preview && preview.for === norm(roblox) ? preview.result : null;

  // Set right before the confirmed submit, so onSubmit lets it through.
  const skipCheck = useRef(false);
  function confirmAndSave() {
    setConfirmed(norm(roblox));
    skipCheck.current = true;
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        if (skipCheck.current) {
          skipCheck.current = false;
          return;
        }
        if (!needsCheck) return;
        e.preventDefault();
        const value = norm(roblox);
        startCheck(async () => {
          const result = await previewRobloxUser(value);
          setPreview({ for: value, result });
        });
      }}
      className={`${card} space-y-5 p-5 sm:p-6`}
    >
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />

      <div>
        <span className={label}>Uniqname</span>
        <p className="rounded-[10px] border border-line/50 bg-bg-2/50 px-4 py-3 font-semibold text-fg-2">{uniqname}</p>
      </div>

      <div>
        <label htmlFor="full_name" className={label}>
          Name
        </label>
        <input id="full_name" name="full_name" required maxLength={100} autoComplete="name" defaultValue={fullName} className={field} />
      </div>

      <div>
        <label htmlFor="roblox_username" className={label}>
          Roblox username <span className="font-normal text-fg-3">(optional)</span>
        </label>
        <input
          id="roblox_username"
          name="roblox_username"
          maxLength={21}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="e.g. builderman"
          value={roblox}
          onChange={(e) => setRoblox(e.target.value)}
          aria-describedby="roblox-help"
          className={field}
        />
        <p id="roblox-help" className="mt-1 text-xs text-fg-3">
          Your Roblox avatar becomes your icon on the site. We check the name with Roblox before saving.
        </p>

        {/* "Is this you?" — only to catch typos; nothing is verified. */}
        <div aria-live="polite">
          {shownPreview?.status === "found" && (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-maize/40 bg-bg-2/60 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={shownPreview.displayName || shownPreview.name} src={shownPreview.headshot} size="lg" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-maize">Is this you?</p>
                  <p className="truncate font-display text-lg font-bold text-fg">{shownPreview.displayName || shownPreview.name}</p>
                  <p className="truncate text-sm text-fg-2">@{shownPreview.name}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={confirmAndSave} disabled={pending} className={button({ size: "sm" })}>
                  <CircleCheck aria-hidden="true" />
                  Yes, save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    document.getElementById("roblox_username")?.focus();
                  }}
                  className={button({ variant: "ghost", size: "sm" })}
                >
                  <Pencil aria-hidden="true" />
                  No, edit
                </button>
              </div>
            </div>
          )}
          {(shownPreview?.status === "not_found" || shownPreview?.status === "invalid") && (
            <p role="alert" className="mt-2 text-sm font-semibold text-bad">
              {shownPreview.message}
            </p>
          )}
          {shownPreview?.status === "unavailable" && (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-line bg-bg-2/60 p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-fg-2">{shownPreview.message}</p>
              <button type="button" onClick={confirmAndSave} disabled={pending} className={button({ variant: "secondary", size: "sm" })}>
                Save anyway
              </button>
            </div>
          )}
        </div>
      </div>

      {state.error && <Alert tone="error" title={state.error} />}
      {state.saved && (
        <p role="status" className="flex items-center gap-2 font-semibold text-ok">
          <CircleCheck aria-hidden="true" className="size-5" /> Saved!
        </p>
      )}
      {state.notice && <p className="text-sm text-fg-2">{state.notice}</p>}

      <button type="submit" disabled={pending || checking} className={button({ size: "lg", full: true })}>
        {checking ? (
          <>
            <Search aria-hidden="true" />
            Checking Roblox…
          </>
        ) : pending ? (
          "Saving…"
        ) : mode === "welcome" ? (
          "Let's go"
        ) : (
          "Save"
        )}
      </button>
    </form>
  );
}
