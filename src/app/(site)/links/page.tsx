import type { Metadata } from "next";
import { PageTitle } from "@/components/Notice";
import { clubLinks } from "@/lib/links";

export const metadata: Metadata = { title: "Links" };

export default function LinksPage() {
  const links = clubLinks.filter((l) => l.href);

  return (
    <div className="mx-auto max-w-md">
      <PageTitle kicker="Find us">Links</PageTitle>
      {links.length ? (
        <ul className="space-y-4">
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`block-card block p-4 transition-transform hover:-translate-y-0.5 ${link.color}`}
              >
                <span className="font-display text-xl">{link.label} ↗</span>
                <span className="block text-sm opacity-90">{link.blurb}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="block-card p-4">Links are coming soon.</p>
      )}
    </div>
  );
}
