import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { button, card } from "@/components/ui/styles";

export function OfficersOnly() {
  return (
    <div className={`${card} mx-auto max-w-lg p-6 text-center`}>
      <ShieldAlert aria-hidden="true" className="mx-auto size-12 text-maize" />
      <h1 className="mt-3 text-2xl text-fg">Officers only</h1>
      <p className="mt-2 text-fg-2">
        This page is for club officers. If you should have access, ask a current officer to make you one from the
        Members page.
      </p>
      <Link href="/" className={button({ variant: "secondary", className: "mt-5" })}>
        Back home
      </Link>
    </div>
  );
}
