// Officer-editable site content: types and rules. No runtime imports: the unit
// tests run this file directly with Node. The database enforces the same limits
// (supabase/migrations/20261205000000_site_content.sql); these give friendly errors.

export const LIMITS = {
  links: 12,
  label: 40,
  blurb: 80,
  url: 500,
  faq: 20,
  question: 150,
  answer: 600,
  whatTitle: 40,
  whatBody: 200,
  featuredTitle: 80,
  featuredBody: 300,
  linkText: 40,
  story: 1200,
  timeline: 30,
  dateLabel: 24,
  milestoneTitle: 80,
  milestoneBody: 240,
} as const;

export type CommunityLink = { label: string; url: string; blurb: string; visible: boolean };
export type FaqItem = { question: string; answer: string };
export type WhatWeDoKey = "game_night" | "social" | "game_jam" | "workshop";
export type WhatWeDoItem = { key: WhatWeDoKey; title: string; body: string };
export type FeaturedPanelContent = {
  enabled: boolean;
  title: string;
  body: string;
  link_text: string | null;
  link_href: string | null;
};
export type Milestone = { date_label: string; title: string; body: string };
/** The editable part of /about (the founders live in code: src/content/founders.ts). */
export type AboutContent = { story: string; timeline: Milestone[] };
export type ContentSection = "links" | "join" | "featured" | "about";
/** Who saved a section last (officers only). `at` is passed back on save to catch overlapping edits. */
export type LastEdit = { at: string; by: string | null } | null;

export const WHAT_WE_DO_KEYS: readonly WhatWeDoKey[] = ["game_night", "social", "game_jam", "workshop"];

type Result<T> = { ok: T } | { error: string };

/** Trims and collapses all whitespace (including line breaks) to single spaces. */
export function cleanText(raw: unknown): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ");
}

// Same as the database checks: no control characters, nothing that looks like a tag.
const LOOKS_LIKE_HTML = /<[A-Za-z/!?]/;
const CONTROL = /[\u0000-\u001f\u007f]/;

function text(raw: unknown, what: string, max: number, required = true): Result<string> {
  const value = cleanText(raw);
  if (!value) return required ? { error: `${what}: write something.` } : { ok: "" };
  if (value.length > max) return { error: `${what}: keep it to ${max} characters (it's ${value.length}).` };
  if (LOOKS_LIKE_HTML.test(value) || CONTROL.test(value)) return { error: `${what}: plain text only, no HTML.` };
  return { ok: value };
}

const BAD_URL_CHARS = /[\s"'<>\\]/;
/** Same as the database: https, lowercase host with a dot, then a path/query/hash. */
export const HTTPS_URL = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+([/?#][^\s"'<>\\]*)?$/;

/** An https link ("discord.gg/abc" gets https:// added). http, mailto, javascript etc. are refused. */
export function normalizeHttpsUrl(raw: unknown, what = "Link"): Result<string> {
  const value = String(raw ?? "").trim();
  if (!value) return { error: `${what}: add the URL.` };
  if (value.startsWith("/") || value.startsWith("\\")) return { error: `${what}: use a full https:// link.` };
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  if (hasScheme && !/^https:\/\//i.test(value)) return { error: `${what}: use an https:// link.` };
  let u: URL;
  try {
    u = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    return { error: `${what}: that doesn't look like a link.` };
  }
  if (u.protocol !== "https:") return { error: `${what}: use an https:// link.` };
  if (u.username || u.password || u.port) return { error: `${what}: that link can't have a username, password or port.` };
  const host = u.hostname.toLowerCase();
  const rest = u.pathname === "/" && !u.search ? u.hash : `${u.pathname}${u.search}${u.hash}`;
  const url = `https://${host}${rest}`;
  if (url.length > LIMITS.url) return { error: `${what}: that link is too long.` };
  if (BAD_URL_CHARS.test(url) || !HTTPS_URL.test(url)) return { error: `${what}: that doesn't look like a link.` };
  return { ok: url };
}

/** A path on this site, also after dot segments resolve ("/..//x" would become "//x", another host). */
function isSamePath(path: string) {
  const notHost = (p: string) => p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\");
  if (!notHost(path)) return false;
  try {
    const base = "http://local.invalid";
    const url = new URL(path, base);
    return url.origin === base && notHost(url.pathname);
  } catch {
    return false;
  }
}

/** Same as the database: a site path with no "//host" start and no dot segments. */
export const SITE_PATH = /^\/([^/\\\s"'<>][^\s"'<>\\]*)?$/;
export const DOT_SEGMENT = /(^|\/)(\.|%2e){1,2}(\/|[?#]|$)/i;

/** Featured link: a path on our site ("/join"; a full link to our own site is stored as its path), or any https link. */
export function normalizeFeaturedHref(raw: unknown, siteHosts: readonly string[]): Result<string> {
  const value = String(raw ?? "").trim();
  const what = "Featured link";
  const badPath = { error: `${what}: use a path on our site like /join, or an https:// link.` };
  const checkPath = (path: string): Result<string> =>
    SITE_PATH.test(path) && !DOT_SEGMENT.test(path) && isSamePath(path) && path.length <= LIMITS.url ? { ok: path } : badPath;
  if (value.startsWith("/")) return checkPath(value);
  const url = normalizeHttpsUrl(value, what);
  if ("error" in url) return url;
  const u = new URL(url.ok);
  if (siteHosts.map((h) => h.toLowerCase()).includes(u.hostname)) return checkPath(`${u.pathname}${u.search}${u.hash}`);
  return url;
}

function asArray(raw: unknown): unknown[] | null {
  return Array.isArray(raw) ? raw : null;
}
function field(item: unknown, key: string): unknown {
  return item && typeof item === "object" ? (item as Record<string, unknown>)[key] : undefined;
}

export function normalizeLinks(raw: unknown): Result<CommunityLink[]> {
  const items = asArray(raw);
  if (!items) return { error: "Couldn't read the links. Reload and try again." };
  if (items.length > LIMITS.links) return { error: `Up to ${LIMITS.links} links.` };
  const links: CommunityLink[] = [];
  for (const [i, item] of items.entries()) {
    const n = `Link ${i + 1}`;
    const label = text(field(item, "label"), `${n} label`, LIMITS.label);
    if ("error" in label) return label;
    const url = normalizeHttpsUrl(field(item, "url"), `${n} (${label.ok}) URL`);
    if ("error" in url) return url;
    const blurb = text(field(item, "blurb"), `${n} (${label.ok}) description`, LIMITS.blurb, false);
    if ("error" in blurb) return blurb;
    links.push({ label: label.ok, url: url.ok, blurb: blurb.ok, visible: field(item, "visible") !== false });
  }
  return { ok: links };
}

export function normalizeFaq(raw: unknown): Result<FaqItem[]> {
  const items = asArray(raw);
  if (!items) return { error: "Couldn't read the FAQ. Reload and try again." };
  if (items.length > LIMITS.faq) return { error: `Up to ${LIMITS.faq} questions.` };
  const faq: FaqItem[] = [];
  for (const [i, item] of items.entries()) {
    const question = text(field(item, "question"), `Question ${i + 1}`, LIMITS.question);
    if ("error" in question) return question;
    const answer = text(field(item, "answer"), `Answer to question ${i + 1}`, LIMITS.answer);
    if ("error" in answer) return answer;
    faq.push({ question: question.ok, answer: answer.ok });
  }
  return { ok: faq };
}

/** All four cards, in the fixed order (each has its own icon). */
export function normalizeWhatWeDo(raw: unknown): Result<WhatWeDoItem[]> {
  const items = asArray(raw);
  if (!items) return { error: "Couldn't read “What we do”. Reload and try again." };
  const out: WhatWeDoItem[] = [];
  for (const [i, key] of WHAT_WE_DO_KEYS.entries()) {
    const item = items.find((x) => field(x, "key") === key);
    if (!item) return { error: "All four “What we do” cards are needed." };
    const title = text(field(item, "title"), `“What we do” card ${i + 1} title`, LIMITS.whatTitle);
    if ("error" in title) return title;
    const body = text(field(item, "body"), `“What we do” card ${i + 1} (${title.ok}) text`, LIMITS.whatBody);
    if ("error" in body) return body;
    out.push({ key, title: title.ok, body: body.ok });
  }
  return { ok: out };
}

export function normalizeFeatured(raw: unknown, siteHosts: readonly string[]): Result<FeaturedPanelContent> {
  const title = text(field(raw, "title"), "Featured title", LIMITS.featuredTitle);
  if ("error" in title) return title;
  const body = text(field(raw, "body"), "Featured text", LIMITS.featuredBody);
  if ("error" in body) return body;
  const linkText = text(field(raw, "link_text"), "Featured link text", LIMITS.linkText, false);
  if ("error" in linkText) return linkText;
  const hrefRaw = String(field(raw, "link_href") ?? "").trim();
  if (!linkText.ok && !hrefRaw) {
    return { ok: { enabled: field(raw, "enabled") === true, title: title.ok, body: body.ok, link_text: null, link_href: null } };
  }
  if (!linkText.ok) return { error: "Featured link text: add it, or clear the link too." };
  if (!hrefRaw) return { error: "Featured link: add it, or clear the link text too." };
  const href = normalizeFeaturedHref(hrefRaw, siteHosts);
  if ("error" in href) return href;
  return {
    ok: { enabled: field(raw, "enabled") === true, title: title.ok, body: body.ok, link_text: linkText.ok, link_href: href.ok },
  };
}

/** The editable About page: story and timeline (in order). */
export function normalizeAbout(raw: unknown): Result<AboutContent> {
  const story = text(field(raw, "story"), "Story", LIMITS.story);
  if ("error" in story) return story;

  const timelineRaw = asArray(field(raw, "timeline"));
  if (!timelineRaw) return { error: "Couldn't read the timeline. Reload and try again." };
  if (timelineRaw.length > LIMITS.timeline) return { error: `Up to ${LIMITS.timeline} timeline items.` };
  const timeline: Milestone[] = [];
  for (const [i, item] of timelineRaw.entries()) {
    const n = `Timeline item ${i + 1}`;
    const date = text(field(item, "date_label"), `${n} date`, LIMITS.dateLabel);
    if ("error" in date) return date;
    const title = text(field(item, "title"), `${n} title`, LIMITS.milestoneTitle);
    if ("error" in title) return title;
    const body = text(field(item, "body"), `${n} (${title.ok}) text`, LIMITS.milestoneBody, false);
    if ("error" in body) return body;
    timeline.push({ date_label: date.ok, title: title.ok, body: body.ok });
  }

  return { ok: { story: story.ok, timeline } };
}

/** Initials for an avatar fallback: "Ada Lovelace" → "AL", "builderman" → "B". */
export function initials(name: string): string {
  const words = cleanText(name).split(" ").filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((w) => [...w][0]?.toUpperCase() ?? "").join("") || "?";
}

/** Known community sites get their own icon and button wording. */
export type LinkPlatform = "instagram" | "groupme" | "discord" | "roblox" | "linkedin" | "maizepages";

const PLATFORMS: [RegExp, LinkPlatform][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)groupme\.com$/, "groupme"],
  [/(^|\.)(discord\.gg|discord\.com)$/, "discord"],
  [/(^|\.)roblox\.com$/, "roblox"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/^maizepages\.umich\.edu$/, "maizepages"],
];

export function linkPlatform(url: string): LinkPlatform | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return PLATFORMS.find(([re]) => re.test(host))?.[1] ?? null;
}
