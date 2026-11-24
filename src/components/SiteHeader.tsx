import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "./Logo";
import { AccountNav } from "./AccountNav";

const nav = [
  { href: "/events", label: "Events" },
  { href: "/links", label: "Links" },
];

export function SiteHeader() {
  return (
    <header className="border-b-4 border-blue bg-blue text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="shrink-0">
          <Wordmark tone="white" className="h-7 w-auto sm:h-9" />
        </Link>
        <Suspense fallback={<div className="h-10 w-20" />}>
          <AccountNav />
        </Suspense>
      </div>
      <nav className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 pb-3">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="border-2 border-white/30 px-3 py-1.5 font-display text-sm uppercase tracking-wide hover:border-maize hover:text-maize"
          >
            {item.label}
          </Link>
        ))}
        <Link href="/checkin" className="btn btn-maize btn-sm ml-auto shrink-0">
          Check in
        </Link>
      </nav>
    </header>
  );
}
