import { ArrowUpRight, CalendarPlus, Gamepad2, GraduationCap, Link2, Mail, MailPlus } from "lucide-react";
import type { ComponentType } from "react";
import { DiscordIcon, GroupMeIcon, InstagramIcon, LinkedInIcon } from "@/components/BrandIcons";
import { CALENDAR_URL, EMAIL_LINK, MAILING_LIST_URL } from "@/lib/links";
import { type CommunityLink, type LinkPlatform, linkPlatform } from "@/lib/site-content";
import { button } from "./styles";

type Icon = ComponentType<{ className?: string }>;

/** Known sites get their own icon and button wording; anything else uses the label and a link icon. */
const PLATFORM_META: Record<LinkPlatform, { action: string; icon: Icon }> = {
  instagram: { action: "Follow our Instagram", icon: InstagramIcon },
  groupme: { action: "Join our GroupMe", icon: GroupMeIcon },
  discord: { action: "Join our Discord", icon: DiscordIcon },
  roblox: { action: "Join our Roblox Group", icon: Gamepad2 },
  linkedin: { action: "Follow us on LinkedIn", icon: LinkedInIcon },
  maizepages: { action: "Find us on Maize Pages", icon: GraduationCap },
};

export function linkMeta(link: { label: string; url: string }): { action: string; icon: Icon } {
  const platform = linkPlatform(link.url);
  return platform ? PLATFORM_META[platform] : { action: link.label, icon: Link2 };
}

function ExternalButton({ href, icon: Icon, children, variant = "secondary", size = "lg" }: {
  href: string; icon: Icon; children: React.ReactNode; variant?: "primary" | "secondary"; size?: "md" | "lg";
}) {
  const external = !href.startsWith("mailto:");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={button({ variant, size, full: true, className: "justify-between! text-left whitespace-normal!" })}
    >
      <span className="inline-flex min-w-0 items-center gap-3">
        <Icon className={`size-5 shrink-0 ${variant === "primary" ? "" : "text-maize"}`} />
        {children}
      </span>
      <ArrowUpRight aria-hidden="true" className={variant === "primary" ? "" : "text-fg-3"} />
      {external && <span className="sr-only">(opens in a new tab)</span>}
    </a>
  );
}

function Blurb({ label, blurb }: { label: string; blurb: string }) {
  return (
    <span className="flex flex-col items-start py-2 text-left leading-tight">
      <span>{label}</span>
      {blurb && <span className="mt-0.5 text-sm font-normal whitespace-normal text-fg-2">{blurb}</span>}
    </span>
  );
}

/**
 * Community link buttons, in the order given. With `withBlurb` (the /links
 * page): label and description; otherwise the action ("Join our Discord").
 * `withEmail` adds the officers' email last.
 */
export function ClubLinkButtons({
  links,
  size = "lg",
  withBlurb = false,
  withEmail = false,
}: {
  links: CommunityLink[];
  size?: "md" | "lg";
  withBlurb?: boolean;
  withEmail?: boolean;
}) {
  if (links.length === 0 && !withEmail) return null;
  return (
    <ul className="space-y-3">
      {links.map((link, i) => {
        const meta = linkMeta(link);
        return (
          <li key={`${i}-${link.url}`}>
            <ExternalButton href={link.url} icon={meta.icon} size={size}>
              {withBlurb ? <Blurb label={link.label} blurb={link.blurb} /> : meta.action}
            </ExternalButton>
          </li>
        );
      })}
      {withEmail && (
        <li>
          <ExternalButton href={EMAIL_LINK.href} icon={Mail} size={size}>
            {withBlurb ? <Blurb label={EMAIL_LINK.label} blurb={EMAIL_LINK.blurb} /> : "Email the officers"}
          </ExternalButton>
        </li>
      )}
    </ul>
  );
}

/** Small round icon links (footer). */
export function ClubLinkIcons({ links }: { links: CommunityLink[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {links.map((link, i) => {
        const Icon = linkMeta(link).icon;
        return (
          <li key={`${i}-${link.url}`}>
            <a
              href={link.url}
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
