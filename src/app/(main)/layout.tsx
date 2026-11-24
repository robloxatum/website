import { SiteChrome } from "@/components/site/SiteChrome";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
