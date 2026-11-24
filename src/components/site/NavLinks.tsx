"use client";

import { CalendarDays, Home, QrCode, UserRound, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

export const MAIN_NAV = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/join", label: "Join" },
  { href: "/links", label: "Links" },
] as const;

export function isActive(pathname: string | null, href: string) {
  if (pathname === null) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The pathname is request data, so on dynamic routes it streams in: the nav
 * prerenders without an active item and lights up as soon as it's known.
 */
export function withPathname(Nav: (props: { pathname: string | null }) => React.ReactNode) {
  function Live() {
    return <Nav pathname={usePathname()} />;
  }
  return function NavWithPathname() {
    return (
      <Suspense fallback={<Nav pathname={null} />}>
        <Live />
      </Suspense>
    );
  };
}

/** Desktop header nav with an animated maize underline on the current page. */
export const DesktopNav = withPathname(function DesktopNavInner({ pathname }) {
  return (
    <nav aria-label="Main" className="hidden h-full items-stretch gap-1 md:flex">
      {MAIN_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center px-2.5 lg:px-3 text-[15px] font-semibold transition-colors duration-150 ${
              active ? "text-fg" : "text-fg-2 hover:text-fg"
            }`}
          >
            {item.label}
            <span
              aria-hidden="true"
              className={`absolute inset-x-2.5 lg:inset-x-3 bottom-0 h-[3px] origin-center rounded-full bg-maize transition-transform duration-200 ease-out ${
                active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-50"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
});

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/checkin", label: "Check In", icon: QrCode, primary: true },
  { href: "/join", label: "Join", icon: UserPlus },
  { href: "/profile", label: "Account", icon: UserRound },
] as const;

/** Phone bottom tab bar (hidden from md up). */
export const MobileTabBar = withPathname(function MobileTabBarInner({ pathname }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-150 ${
                  active ? "text-maize" : "text-fg-2 hover:text-fg"
                }`}
              >
                {"primary" in tab ? (
                  <span className="-mt-5 grid size-12 place-items-center rounded-2xl bg-maize text-navy shadow-[0_8px_20px_-8px_rgb(240_196_19/0.7)]">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                ) : (
                  <Icon aria-hidden="true" className="size-[22px]" />
                )}
                {tab.label}
                <span
                  aria-hidden="true"
                  className={`absolute top-0 h-[3px] w-8 rounded-full bg-maize transition-transform duration-200 ${
                    active && !("primary" in tab) ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});
