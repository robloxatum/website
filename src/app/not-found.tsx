import { NotFoundContent } from "@/components/NotFoundContent";
import { SiteChrome } from "@/components/site/SiteChrome";

export const metadata = { title: "Page not found", robots: { index: false } };

/** Unknown URLs: no group layout applies, so bring the site header and footer. */
export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundContent />
    </SiteChrome>
  );
}
