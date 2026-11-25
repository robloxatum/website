import type { Metadata } from "next";
import { OfficerBottomNav, OfficerSidebar } from "@/components/officer/OfficerNav";
import { SiteHeader } from "@/components/site/SiteHeader";
import { container } from "@/components/ui/styles";

/** Officers only: keep the portal out of search results. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Officer portal: sidebar on desktop, bottom nav on phones. Each page checks officer status. */
export default function OfficerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className={`${container} max-w-7xl! flex-1 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10`}>
        <aside className="hidden pt-10 lg:block">
          <OfficerSidebar />
        </aside>
        <main id="main" className="min-w-0 pt-6 pb-28 lg:pt-10 lg:pb-16">
          {children}
        </main>
      </div>
      <OfficerBottomNav />
    </div>
  );
}
