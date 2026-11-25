import type { Metadata } from "next";
import { Suspense } from "react";
import { OfficersOnly } from "@/components/OfficersOnly";
import { Alert } from "@/components/ui/Alert";
import { PageHeader, Skeleton } from "@/components/ui/Primitives";
import { getOfficer } from "@/lib/auth";
import { AboutSection } from "./AboutSection";
import { getContentForOfficer } from "./data";
import { FeaturedSection } from "./FeaturedSection";
import { JoinSection } from "./JoinSection";
import { LinksSection } from "./LinksSection";

export const metadata: Metadata = { title: "Site content" };

export default function ContentPage() {
  return (
    <div>
      <PageHeader
        label="Officer portal"
        title="Site content"
        description="Community links, the Join page FAQ, the home page Featured panel and the About page. Saving updates the site right away."
      />
      <Suspense fallback={<Skeleton className="h-[40rem]" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  if (!(await getOfficer("/officer/content"))) return <OfficersOnly />;
  const content = await getContentForOfficer();
  if (!content) {
    return (
      <Alert tone="error" title="Couldn’t load the site content">
        Reload the page to try again. Nothing was changed.
      </Alert>
    );
  }
  return (
    <div className="space-y-8">
      <LinksSection links={content.links} edit={content.edits.links} />
      <JoinSection content={{ faq: content.faq, whatWeDo: content.whatWeDo }} edit={content.edits.join} />
      <FeaturedSection featured={content.featured} edit={content.edits.featured} />
      <AboutSection content={content.about} edit={content.edits.about} />
    </div>
  );
}
