"use client";

import { ArrowLeft, CalendarDays, LayoutDashboard, QrCode, Users } from "lucide-react";
import Link from "next/link";
import { withPathname } from "@/components/site/NavLinks";

const ITEMS = [
  { href: "/officer", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/officer/events", label: "Events", icon: CalendarDays },
  { href: "/officer/members", label: "Members", icon: Users },
  { href: "/officer/flyer", label: "Flyer QR", icon: QrCode },
] as const;

function active(pathname: string | null, href: string, exact?: boolean) {
  if (!pathname) return false;
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar (mockup: Dashboard / Events / Members). */
export const OfficerSidebar = withPathname(function OfficerSidebarInner({ pathname }) {
  return (
    <nav aria-label="Officer" className="sticky top-24 space-y-1">
      <p className="mb-3 px-3 text-xs font-semibold tracking-[0.22em] text-fg-3 uppercase">Officer portal</p>
      {ITEMS.map((item) => {
        const on = active(pathname, item.href, "exact" in item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 font-semibold transition-colors duration-150 ${
              on ? "border-maize/50 bg-maize/12 text-maize" : "border-transparent text-fg-2 hover:bg-white/[0.05] hover:text-fg"
            }`}
          >
            <Icon aria-hidden="true" className="size-5" />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-4 border-t border-line/50 pt-4">
        <Link href="/" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-fg-3 hover:text-fg">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to the site
        </Link>
      </div>
    </nav>
  );
});

/** Phone bottom nav for the officer portal. */
export const OfficerBottomNav = withPathname(function OfficerBottomNavInner({ pathname }) {
  return (
    <nav
      aria-label="Officer"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {ITEMS.map((item) => {
          const on = active(pathname, item.href, "exact" in item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={on ? "page" : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-150 ${
                  on ? "text-maize" : "text-fg-2 hover:text-fg"
                }`}
              >
                <Icon aria-hidden="true" className="size-[22px]" />
                {item.label}
                <span
                  aria-hidden="true"
                  className={`absolute top-0 h-[3px] w-8 rounded-full bg-maize transition-transform duration-200 ${on ? "scale-x-100" : "scale-x-0"}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});
