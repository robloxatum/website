import { Suspense } from "react";
import { getActiveAnnouncement } from "@/lib/announcements";
import { getMemberNav } from "@/lib/member-nav";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { MobileTabBar, SIGNED_OUT } from "./NavLinks";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** Header, footer and the phone tab bar around a public/member page. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <Suspense fallback={null}>
        <Announcement />
      </Suspense>
      <main id="main" className="flex-1">{children}</main>
      <SiteFooter />
      {/* Signed-out tabs until the session is known, so signed-out visitors see no shift. */}
      <Suspense fallback={<MobileTabBar nav={SIGNED_OUT} />}>
        <MemberTabBar />
      </Suspense>
    </div>
  );
}

/** Phone tab bar for this visitor (Join vs Links, Check In vs Play). */
async function MemberTabBar() {
  return <MobileTabBar nav={await getMemberNav()} />;
}

/** Officer-set announcement under the header (cached; see lib/announcements). */
async function Announcement() {
  const announcement = await getActiveAnnouncement();
  return announcement ? <AnnouncementBanner key={announcement.id} announcement={announcement} /> : null;
}
