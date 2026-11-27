// Security audit 3, L-2: the privacy page says what the site actually stores,
// shares and keeps. Every table in the migrations must be listed here, either
// with the words on the privacy page that cover it or as holding no personal
// data, so a new table fails this test until the page is updated. Run: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const page = readFileSync(new URL("../src/app/(main)/privacy/page.tsx", import.meta.url), "utf8")
  .replace(/&apos;|&rsquo;/g, "'")
  .replace(/&ldquo;|&rdquo;/g, '"')
  .replace(/\s+/g, " ");

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
/** Tables that exist after every migration has run, in order. */
function tables() {
  const live = new Set();
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(new URL(f, migrationsDir), "utf8").replace(/--.*$/gm, "");
    for (const m of sql.matchAll(/\b(create|drop) table (?:if (?:not )?exists )?([a-z_]+\.[a-z_]+)/gi)) {
      if (m[1].toLowerCase() === "create") live.add(m[2]);
      else live.delete(m[2]);
    }
  }
  return [...live].sort();
}

/** Table → phrases the privacy page must contain, or null for "no personal data". */
const COVERED = {
  "public.profiles": ["umich.edu email address and uniqname", "A nickname", "Your Roblox username", "Roblox user ID"],
  "public.attendance": ["Which club events you checked in to, and when"],
  "public.event_rsvps": ["RSVPs"],
  "public.push_subscriptions": ["push service", "Turning them off or signing out on that device deletes it"],
  "private.checkin_failures": ["wrong check-in codes", "Times older than a day are deleted the next time you check in"],
  "private.roblox_lookups": ["changed your Roblox username", "Times older than a minute are deleted"],
  "public.events": ["which officer created an event"],
  "public.site_content_edits": ["last edited site content"],
  "public.event_game_servers": null, // game links; updated_by is an officer (covered by the line above)
  "public.event_codes": null,
  "public.event_reminders_sent": null,
  "public.announcements": null,
  "public.community_links": null,
  "public.featured_panel": null,
  "public.join_faq": null,
  "public.join_what_we_do": null,
  "public.about_story": null,
  "public.about_timeline": null,
};

describe("privacy page", () => {
  it("covers every table in the database", () => {
    for (const t of tables()) {
      assert.ok(t in COVERED, `${t} is new: add what it stores to the privacy page and to COVERED here`);
      for (const phrase of COVERED[t] ?? []) assert.ok(page.includes(phrase), `${t}: the page says "${phrase}"`);
    }
  });

  it("states sharing with Roblox, cookies, retention and data outside the site", () => {
    for (const phrase of [
      "our server sends the Roblox username you entered to Roblox",
      "which see your device's IP address",
      "one short-lived cookie finishes signing you in",
      'whether you closed the "install" bar',
      "How long we keep it",
      "Tell us when you graduate or leave",
      '"Get event updates" Google Form',
      "only when 10 or more did",
      "We'll reply to deletion requests within two weeks.",
    ]) {
      assert.ok(page.includes(phrase), phrase);
    }
  });

  it("no longer makes the claims the site didn't keep", () => {
    assert.doesNotMatch(page, /These are deleted after a day/);
    assert.doesNotMatch(page, /The only cookie/);
  });
});
