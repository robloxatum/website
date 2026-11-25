import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CommunityLink, FaqItem, FeaturedPanelContent, Milestone, WhatWeDoItem } from "./site-content";
import { createPublicClient } from "./supabase/public";

/**
 * Officer-editable content for the public pages (anon reads; RLS hides hidden
 * links). Cached, and refreshed right away when an officer saves on
 * /officer/content (cache tag "site-content"). On an error the section is
 * left out rather than failing the page.
 */
export const SITE_CONTENT_TAG = "site-content";

/** Shown community links, in order. */
export async function getCommunityLinks(): Promise<CommunityLink[]> {
  "use cache";
  cacheTag(SITE_CONTENT_TAG);
  cacheLife("minutes");
  const { data, error } = await createPublicClient()
    .from("community_links")
    .select("label, url, blurb, visible")
    .eq("visible", true)
    .order("position");
  if (error) console.error("Failed to load community links", error.message);
  return (data ?? []) as CommunityLink[];
}

export async function getJoinContent(): Promise<{ faq: FaqItem[]; whatWeDo: WhatWeDoItem[] }> {
  "use cache";
  cacheTag(SITE_CONTENT_TAG);
  cacheLife("minutes");
  const supabase = createPublicClient();
  const [faq, what] = await Promise.all([
    supabase.from("join_faq").select("question, answer").order("position"),
    supabase.from("join_what_we_do").select("key, title, body").order("position"),
  ]);
  if (faq.error) console.error("Failed to load the FAQ", faq.error.message);
  if (what.error) console.error("Failed to load what we do", what.error.message);
  return { faq: (faq.data ?? []) as FaqItem[], whatWeDo: (what.data ?? []) as WhatWeDoItem[] };
}

/** The home page Featured panel, or null when it's switched off. */
export async function getFeaturedPanel(): Promise<FeaturedPanelContent | null> {
  "use cache";
  cacheTag(SITE_CONTENT_TAG);
  cacheLife("minutes");
  const { data, error } = await createPublicClient()
    .from("featured_panel")
    .select("enabled, title, body, link_text, link_href")
    .maybeSingle<FeaturedPanelContent>();
  if (error) console.error("Failed to load the featured panel", error.message);
  return data?.enabled ? data : null;
}

export type AboutPersonPublic = { name: string; role: string; blurb: string; roblox_username: string | null; roblox_user_id: number | null };

/** The About page: story, timeline and the shown people, in order. Null story if it failed to load. */
export async function getAboutContent(): Promise<{ story: string | null; timeline: Milestone[]; people: AboutPersonPublic[] }> {
  "use cache";
  cacheTag(SITE_CONTENT_TAG);
  cacheLife("minutes");
  const supabase = createPublicClient();
  const [story, timeline, people] = await Promise.all([
    supabase.from("about_story").select("body").maybeSingle<{ body: string }>(),
    supabase.from("about_timeline").select("date_label, title, body").order("position"),
    supabase.from("about_people").select("name, role, blurb, roblox_username, roblox_user_id").eq("visible", true).order("position"),
  ]);
  for (const r of [story, timeline, people]) if (r.error) console.error("Failed to load the About page", r.error.message);
  return {
    story: story.data?.body ?? null,
    timeline: (timeline.data ?? []) as Milestone[],
    people: (people.data ?? []) as AboutPersonPublic[],
  };
}
