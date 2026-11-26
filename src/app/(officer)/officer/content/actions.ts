"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { officerName } from "@/lib/names";
import {
  type AboutContent,
  type CommunityLink,
  type FaqItem,
  type FeaturedPanelContent,
  type LastEdit,
  type WhatWeDoItem,
  normalizeAbout,
  normalizeFaq,
  normalizeFeatured,
  normalizeLinks,
  normalizeWhatWeDo,
} from "@/lib/site-content";
import { SITE_CONTENT_TAG } from "@/lib/site-content-data";
import { createClient } from "@/lib/supabase/server";

/**
 * Saves for /officer/content. Each replaces one section in a single database
 * transaction (public.save_* functions), then refreshes the public pages.
 * These checks give friendly errors; RLS and the database checks are the real gate.
 */

export type SaveState<T> = {
  error?: string;
  /** Bumped on every successful save; the form restarts from `content`. */
  version?: number;
  content?: T;
  lastEdit?: LastEdit;
};

export type LinksState = SaveState<CommunityLink[]>;
export type JoinState = SaveState<{ faq: FaqItem[]; whatWeDo: WhatWeDoItem[] }>;
export type FeaturedState = SaveState<FeaturedPanelContent>;
export type AboutState = SaveState<AboutContent>;

async function requireOfficer() {
  const profile = await getProfile();
  if (!profile) redirect("/login?next=/officer/content");
  if (!profile.is_officer) throw new Error("Officers only");
  return profile;
}

function parseJson(formData: FormData, name: string): unknown {
  try {
    return JSON.parse(String(formData.get(name) ?? ""));
  } catch {
    return null;
  }
}

/** The section's last-edited time the form was opened with ("" = never edited). */
function expected(formData: FormData): string | null {
  return String(formData.get("expected") ?? "") || null;
}

function saveError(error: { code?: string; message: string }): string {
  if (error.code === "40001") {
    return "Someone else saved this section after you opened the page. Copy anything you want to keep, then reload to see their changes.";
  }
  if (error.code === "42501") return "Only officers can change site content.";
  if (error.code === "23514") return "Something didn't pass the site's rules. Check the fields and try again.";
  console.error("Failed to save site content", error.message);
  return "Couldn't save. Please try again.";
}

/** Our own hosts, so a full link to this site is stored as a path. */
async function siteHosts() {
  const hosts = new Set<string>();
  const host = (await headers()).get("host")?.split(":")[0];
  if (host) hosts.add(host);
  try {
    if (process.env.NEXT_PUBLIC_SITE_URL) hosts.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname);
  } catch {}
  return [...hosts];
}

export async function saveLinks(prev: LinksState, formData: FormData): Promise<LinksState> {
  const officer = await requireOfficer();
  const links = normalizeLinks(parseJson(formData, "links"));
  if ("error" in links) return { ...prev, error: links.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_community_links", { p_expected: expected(formData), p_links: links.ok });
  if (error) return { ...prev, error: saveError(error) };
  updateTag(SITE_CONTENT_TAG);
  return { version: (prev.version ?? 0) + 1, content: links.ok, lastEdit: { at: data as string, by: officerName(officer) } };
}

export async function saveJoinContent(prev: JoinState, formData: FormData): Promise<JoinState> {
  const officer = await requireOfficer();
  const whatWeDo = normalizeWhatWeDo(parseJson(formData, "whatWeDo"));
  if ("error" in whatWeDo) return { ...prev, error: whatWeDo.error };
  const faq = normalizeFaq(parseJson(formData, "faq"));
  if ("error" in faq) return { ...prev, error: faq.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_join_content", {
    p_expected: expected(formData),
    p_faq: faq.ok,
    p_what: whatWeDo.ok,
  });
  if (error) return { ...prev, error: saveError(error) };
  updateTag(SITE_CONTENT_TAG);
  return {
    version: (prev.version ?? 0) + 1,
    content: { faq: faq.ok, whatWeDo: whatWeDo.ok },
    lastEdit: { at: data as string, by: officerName(officer) },
  };
}

export async function saveFeatured(prev: FeaturedState, formData: FormData): Promise<FeaturedState> {
  const officer = await requireOfficer();
  const featured = normalizeFeatured(parseJson(formData, "featured"), await siteHosts());
  if ("error" in featured) return { ...prev, error: featured.error };
  const f = featured.ok;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_featured_panel", {
    p_expected: expected(formData),
    p_enabled: f.enabled,
    p_title: f.title,
    p_body: f.body,
    p_link_text: f.link_text,
    p_link_href: f.link_href,
  });
  if (error) return { ...prev, error: saveError(error) };
  updateTag(SITE_CONTENT_TAG);
  return { version: (prev.version ?? 0) + 1, content: f, lastEdit: { at: data as string, by: officerName(officer) } };
}

export async function saveAbout(prev: AboutState, formData: FormData): Promise<AboutState> {
  const officer = await requireOfficer();
  const about = normalizeAbout(parseJson(formData, "about"));
  if ("error" in about) return { ...prev, error: about.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_about_page", {
    p_expected: expected(formData),
    p_story: about.ok.story,
    p_timeline: about.ok.timeline,
  });
  if (error) return { ...prev, error: saveError(error) };
  updateTag(SITE_CONTENT_TAG);
  return { version: (prev.version ?? 0) + 1, content: about.ok, lastEdit: { at: data as string, by: officerName(officer) } };
}
