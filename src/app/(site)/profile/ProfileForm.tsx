"use client";

import { useActionState } from "react";
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
    <form action={action} className="block-card space-y-5 p-5">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />

      <div>
        <span className="label">Uniqname</span>
        <p className="border-4 border-blue/30 bg-cream px-3 py-3 font-semibold">{uniqname}</p>
      </div>

      <div>
        <label htmlFor="full_name" className="label">
          Name
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          maxLength={100}
          autoComplete="name"
          defaultValue={fullName}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="roblox_username" className="label">
          Roblox username <span className="text-blue/50 normal-case">(optional)</span>
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
          className="field"
        />
      </div>

      {state.error && (
        <p role="alert" className="font-semibold text-brick">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="font-semibold text-grass">
          Saved!
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-maize w-full">
        {pending ? "Saving…" : mode === "welcome" ? "Let's go" : "Save"}
      </button>
    </form>
  );
}
