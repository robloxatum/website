"use client";

import "./globals.css";

/**
 * Last resort: the root layout itself failed, so this renders its own <html>.
 * No site chrome or fonts; plain but on-brand.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-bg p-6 text-center text-fg">
        <div className="max-w-md space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image needs the app shell that just failed */}
          <img src="/icon.png" alt="" width={96} height={96} className="mx-auto size-24 rounded-2xl" />
          <h1 className="text-4xl font-extrabold">Oof. Something broke.</h1>
          <p className="text-lg text-fg-2">The site hit an error. Try again in a moment.</p>
          {error.digest && <p className="text-xs text-fg-3">Error code: {error.digest}</p>}
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="min-h-13 rounded-[10px] bg-maize px-6 font-semibold text-navy hover:bg-maize-hover"
            >
              Try again
            </button>
            {/* A full reload, since the app shell is broken. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="inline-flex min-h-13 items-center justify-center rounded-[10px] border border-line px-6 font-semibold">
              Respawn at home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
