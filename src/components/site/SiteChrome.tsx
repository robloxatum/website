import { MobileTabBar } from "./NavLinks";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** Header, footer and the phone tab bar around a page. */
export function SiteChrome({ children, legacy = false }: { children: React.ReactNode; legacy?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      {legacy ? (
        // Pages not yet redesigned keep their old light styles until their phase.
        <div className="legacy flex-1">
          <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-24 md:pb-8">{children}</main>
        </div>
      ) : (
        <main id="main" className="flex-1">{children}</main>
      )}
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
