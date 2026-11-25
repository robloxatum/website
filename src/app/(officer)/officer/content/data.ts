import "server-only";
import { officerName } from "@/lib/names";
import type {
  CommunityLink,
  ContentSection,
  FaqItem,
  FeaturedPanelContent,
  LastEdit,
  WhatWeDoItem,
} from "@/lib/site-content";
import { createClient } from "@/lib/supabase/server";

export type OfficerContent = {
  links: CommunityLink[];
  faq: FaqItem[];
  whatWeDo: WhatWeDoItem[];
  featured: FeaturedPanelContent;
  edits: Record<ContentSection, LastEdit>;
};

type EditRow = {
  section: ContentSection;
  updated_at: string;
  profiles: { full_name: string; uniqname: string; nickname: string | null } | null;
};

/**
 * Everything on /officer/content, as officers see it (hidden links too), plus
 * who saved each section last. Null if anything failed to load: the editor
 * must never start from a partial copy and save it over the real content.
 */
export async function getContentForOfficer(): Promise<OfficerContent | null> {
  const supabase = await createClient();
  const [links, faq, what, featured, edits] = await Promise.all([
    supabase.from("community_links").select("label, url, blurb, visible").order("position"),
    supabase.from("join_faq").select("question, answer").order("position"),
    supabase.from("join_what_we_do").select("key, title, body").order("position"),
    supabase.from("featured_panel").select("enabled, title, body, link_text, link_href").maybeSingle<FeaturedPanelContent>(),
    supabase.from("site_content_edits").select("section, updated_at, profiles(full_name, uniqname, nickname)").returns<EditRow[]>(),
  ]);
  const failed = [links, faq, what, featured, edits].find((r) => r.error);
  if (failed?.error) {
    console.error("Failed to load site content", failed.error.message);
    return null;
  }
  if (!featured.data || (what.data ?? []).length !== 4) {
    console.error("Site content is missing rows (featured panel or what we do)");
    return null;
  }
  const lastEdit = (section: ContentSection): LastEdit => {
    const row = (edits.data ?? []).find((e) => e.section === section);
    return row ? { at: row.updated_at, by: row.profiles ? officerName(row.profiles) : null } : null;
  };
  return {
    links: (links.data ?? []) as CommunityLink[],
    faq: (faq.data ?? []) as FaqItem[],
    whatWeDo: (what.data ?? []) as WhatWeDoItem[],
    featured: featured.data,
    edits: { links: lastEdit("links"), join: lastEdit("join"), featured: lastEdit("featured") },
  };
}
