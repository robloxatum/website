import { SiteChrome } from "@/components/site/SiteChrome";

/** Pages not yet redesigned (they move to (main) phase by phase). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome legacy>{children}</SiteChrome>;
}
