import { ArrowUpRight, CalendarPlus, Gamepad2, GraduationCap, Mail, MailPlus } from "lucide-react";
import type { ComponentType } from "react";
import { DiscordIcon, GroupMeIcon, InstagramIcon, LinkedInIcon } from "@/components/BrandIcons";
import { CALENDAR_URL, clubLink, MAILING_LIST_URL, type ClubLinkKey } from "@/lib/links";
import { button } from "./styles";

type Icon = ComponentType<{ className?: string }>;

export const LINK_META: Record<ClubLinkKey, { action: string; icon: Icon }> = {
  instagram: { action: "Follow our Instagram", icon: InstagramIcon },
  groupme: { action: "Join our GroupMe", icon: GroupMeIcon },
  discord: { action: "Join our Discord", icon: DiscordIcon },
  roblox: { action: "Join our Roblox Group", icon: Gamepad2 },
  linkedin: { action: "Follow us on LinkedIn", icon: LinkedInIcon },
  maizepages: { action: "Maize Pages", icon: GraduationCap },
  email: { action: "Email the officers", icon: Mail },
};

function ExternalButton({ href, icon: Icon, children, variant = "secondary", size = "lg" }: {
  href: string; icon: Icon; children: React.ReactNode; variant?: "primary" | "secondary"; size?: "md" | "lg";
}) {
  const external = !href.startsWith("mailto:");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={button({ variant, size, full: true, className: "justify-between! text-left" })}
    >
      <span className="inline-flex items-center gap-3">
        <Icon className={`size-5 shrink-0 ${variant === "primary" ? "" : "text-maize"}`} />
        {children}
      </span>
      <ArrowUpRight aria-hidden="true" className={variant === "primary" ? "" : "text-fg-3"} />
      {external && <span className="sr-only">(opens in a new tab)</span>}
    </a>
  );
}

/** Community link buttons, in the order given. Links without a URL are hidden. */
export function ClubLinkButtons({ keys, size = "lg", withBlurb = false }: { keys: ClubLinkKey[]; size?: "md" | "lg"; withBlurb?: boolean }) {
  const links = keys.map((k) => clubLink(k)).filter((l) => l !== null);
  if (links.length === 0) return null;
  return (
    <ul className="space-y-3">
      {links.map((link) => (
        <li key={link.key}>
          <ExternalButton href={link.href} icon={LINK_META[link.key].icon} size={size}>
            {withBlurb ? (
              <span className="flex flex-col items-start py-2 text-left leading-tight">
                <span>{link.label}</span>
                <span className="mt-0.5 text-sm font-normal whitespace-normal text-fg-2">{link.blurb}</span>
              </span>
            ) : (
              LINK_META[link.key].action
            )}
          </ExternalButton>
        </li>
      ))}
    </ul>
  );
}

/** Small round icon links (footer). */
export function ClubLinkIcons({ keys }: { keys: ClubLinkKey[] }) {
  const links = keys.map((k) => clubLink(k)).filter((l) => l !== null);
  return (
    <ul className="flex flex-wrap gap-2">
      {links.map((link) => {
        const Icon = LINK_META[link.key].icon;
        return (
          <li key={link.key}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${link.label} (opens in a new tab)`}
              title={link.label}
              className="grid size-11 place-items-center rounded-[10px] border border-line/70 text-fg-2 transition-colors duration-150 hover:border-maize hover:text-maize"
            >
              <Icon className="size-5" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function MailingListButton({ variant = "secondary", full = false }: { variant?: "primary" | "secondary"; full?: boolean }) {
  return (
    <a
      href={MAILING_LIST_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={button({ variant, full })}
    >
      <MailPlus aria-hidden="true" />
      Get event updates
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function CalendarButton({ variant = "secondary", full = false }: { variant?: "primary" | "secondary"; full?: boolean }) {
  return (
    <a href={CALENDAR_URL} target="_blank" rel="noopener noreferrer" className={button({ variant, full })}>
      <CalendarPlus aria-hidden="true" />
      Subscribe to our calendar
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
