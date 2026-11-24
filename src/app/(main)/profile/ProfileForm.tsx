"use client";

import { CircleCheck } from "lucide-react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { button, card, field, label } from "@/components/ui/styles";
import { saveProfile, type ProfileFormState } from "./actions";

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

  return (
    <form action={action} className={`${card} space-y-5 p-5 sm:p-6`}>
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
          defaultValue={robloxUsername ?? ""}
          className={field}
        />
      </div>

      {state.error && <Alert tone="error" title={state.error} />}
      {state.saved && (
        <p role="status" className="flex items-center gap-2 font-semibold text-ok">
          <CircleCheck aria-hidden="true" className="size-5" /> Saved!
        </p>
      )}

      <button type="submit" disabled={pending} className={button({ size: "lg", full: true })}>
        {pending ? "Saving…" : mode === "welcome" ? "Let's go" : "Save"}
      </button>
    </form>
  );
}
