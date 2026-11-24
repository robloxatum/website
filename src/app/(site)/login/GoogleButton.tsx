"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // Only a hint for Google's account picker; the server enforces umich.edu.
        queryParams: { hd: "umich.edu", prompt: "select_account" },
      },
    });
    if (error) {
      setError("Couldn't start Google sign-in. Please try again.");
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={signIn} disabled={pending} className="btn btn-maize w-full text-lg">
        <GoogleG />
        {pending ? "Opening Google…" : "Sign in with Google"}
      </button>
      {error && (
        <p role="alert" className="mt-3 font-semibold text-brick">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-6 shrink-0 bg-white p-0.5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
