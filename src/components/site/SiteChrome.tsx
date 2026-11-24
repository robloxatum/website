import { MobileTabBar } from "./NavLinks";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** Header, footer and the phone tab bar around a public/member page. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
