import Link from "next/link";

export function OfficerTabs({ active }: { active: "events" | "members" }) {
  const tab = (key: typeof active, href: string, label: string) => (
    <Link
      href={href}
      className={`border-4 border-blue px-4 py-2 font-display text-sm uppercase ${
        active === key ? "bg-blue text-maize" : "bg-white hover:bg-cream"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-6 flex gap-2">
      {tab("events", "/officer", "Events")}
      {tab("members", "/officer/members", "Members")}
    </div>
  );
}
