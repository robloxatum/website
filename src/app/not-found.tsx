import { NotFoundContent } from "@/components/NotFoundContent";
import { SiteChrome } from "@/components/site/SiteChrome";

/** Unknown URLs: no group layout applies, so bring the site header and footer. */
export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundContent />
    </SiteChrome>
  );
}
