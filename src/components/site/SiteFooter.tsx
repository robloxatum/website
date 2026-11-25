import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { ClubLinkIcons } from "@/components/ui/ClubLinkButtons";
import { container } from "@/components/ui/styles";
import { getCommunityLinks } from "@/lib/site-content-data";

const columns = [
  {
    title: "Explore",
    links: [
      { href: "/events", label: "Events" },
      { href: "/join", label: "Join" },
      { href: "/checkin", label: "Check in" },
    ],
  },
  {
    title: "Club",
    links: [
      { href: "/about", label: "About" },
      { href: "/links", label: "Links & contact" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line/60 bg-bg-2 pb-tab-bar md:pb-0">
      <div className={`${container} grid gap-8 py-10 sm:grid-cols-[1fr_auto_auto] sm:gap-16`}>
        <div className="space-y-3">
          <Wordmark tone="white" className="h-6 w-auto" />
          <p className="text-sm font-semibold tracking-[0.18em] text-maize uppercase">Build · Create · Connect</p>
          <p className="max-w-sm text-sm text-fg-2">A student organization at the University of Michigan.</p>
          <div className="pt-2">
            <FooterLinks />
          </div>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-xs font-semibold tracking-[0.18em] text-fg-3 uppercase">{col.title}</p>
            <ul className="mt-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-11 items-center text-sm text-fg-2 hover:text-maize">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line/40">
        <p className={`${container} py-5 text-xs leading-relaxed text-fg-3`}>
          Roblox at UM is an independent student organization, not officially affiliated with or endorsed by Roblox
          Corporation.
        </p>
      </div>
    </footer>
  );
}

/** Community link icons (officer-edited; cached, see lib/site-content-data). */
async function FooterLinks() {
  return <ClubLinkIcons links={await getCommunityLinks()} />;
}
