import { ArrowUpRight, AtSign, Gamepad2, GraduationCap, Mail, MessageCircle, type LucideIcon } from "lucide-react";
import { clubLink, type ClubLinkKey } from "@/lib/links";
import { button } from "./styles";

const meta: Record<ClubLinkKey, { label: string; icon: LucideIcon }> = {
  discord: { label: "Join our Discord", icon: MessageCircle },
  instagram: { label: "Follow our Instagram", icon: AtSign },
  maizepages: { label: "Maize Pages", icon: GraduationCap },
  roblox: { label: "Roblox Group", icon: Gamepad2 },
  email: { label: "Email the officers", icon: Mail },
};

/** Community link buttons. Links without a URL in src/lib/links.ts are hidden. */
export function ClubLinkButtons({ keys, size = "lg" }: { keys: ClubLinkKey[]; size?: "md" | "lg" }) {
  const links = keys.map((k) => ({ key: k, link: clubLink(k) })).filter((x) => x.link);
  if (links.length === 0) return null;
  return (
    <ul className="space-y-3">
      {links.map(({ key, link }) => {
        const { label, icon: Icon } = meta[key];
        const external = !link!.href.startsWith("mailto:");
        return (
          <li key={key}>
            <a
              href={link!.href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={button({ variant: "secondary", size, full: true, className: "justify-between" })}
            >
              <span className="inline-flex items-center gap-3">
                <Icon aria-hidden="true" className="text-maize" />
                {label}
              </span>
              <ArrowUpRight aria-hidden="true" className="text-fg-3" />
              {external && <span className="sr-only">(opens in a new tab)</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
