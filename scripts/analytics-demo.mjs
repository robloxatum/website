// Local-only demo numbers for /officer/analytics?demo=1 (in `next dev`).
//
//   npm run analytics:demo
//
// Builds a throwaway database in memory (PGlite, the same one `npm run
// test:db` uses), applies our migrations, fills it with MADE-UP members,
// events, RSVPs and check-ins, and runs the real public.officer_analytics
// function as an officer for each date range. Writes .analytics-demo.json
// (git-ignored). Never connects to Supabase or production.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { RANGES, rangeBounds } from "../src/lib/analytics.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(readFileSync(join(root, "supabase/tests/supabase-shim.sql"), "utf8"));
const migrations = join(root, "supabase/migrations");
for (const f of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(migrations, f), "utf8"));
}

// Same numbers every run.
let seed = 20261124;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = (weights) => {
  let r = rand() * weights.reduce((n, [, w]) => n + w, 0);
  for (const [v, w] of weights) if ((r -= w) < 0) return v;
  return weights[0][0];
};

const DAY = 86_400_000;
const now = Date.now();
const start = Date.UTC(2025, 8, 2); // Sep 2025
const iso = (t) => new Date(t).toISOString();
const uuid = (n) => `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Members: bursts at the start of each term, a trickle in between.
const members = [];
for (let i = 0; i < 260; i++) {
  const burst = rand() < 0.55;
  const t = burst
    ? pick([[Date.UTC(2025, 8, 3), 5], [Date.UTC(2026, 0, 8), 3], [Date.UTC(2026, 7, 28), 4]]) + rand() * 21 * DAY
    : start + rand() * (now - start - DAY);
  members.push({ id: uuid(i + 1), created: Math.min(t, now - DAY), loyalty: rand() ** 1.6 });
}
members.sort((a, b) => a.created - b.created);
const sql = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ${members
  .map((m, i) => `(${sql(m.id)}, 'demo${i + 1}@umich.edu', '{"full_name":"Demo Member ${i + 1}"}')`)
  .join(",")}`);
for (const m of members) await db.query("update public.profiles set created_at = $1 where id = $2", [iso(m.created), m.id]);
await db.query("update public.profiles set is_officer = true where id = $1", [members[0].id]);

// Events: about every 9 days, 7 pm club time, no events over winter break.
const titles = {
  game_night: ["Game Night: Obby Races", "Game Night: Tycoon Tuesday", "Game Night: Horror Maps", "Game Night: Tower Defense", "Game Night: Party Games"],
  workshop: ["Scripting Workshop: Tweens", "Building Workshop: Terrain", "Luau 101", "UI Design in Studio"],
  social: ["Pizza Social", "Board Games & Bloxburg", "End-of-Term Social"],
  meeting: ["General Meeting", "Officer Q&A", "Kickoff Meeting"],
  game_jam: ["48-Hour Game Jam"],
  partner: ["Partner Event with MSGD"],
};
const events = [];
for (let t = Date.UTC(2025, 8, 5, 23); t < now - DAY; t += (7 + Math.floor(rand() * 5)) * DAY) {
  const d = new Date(t);
  if ((d.getUTCMonth() === 11 && d.getUTCDate() > 12) || (d.getUTCMonth() === 0 && d.getUTCDate() < 8)) continue;
  if (d.getUTCMonth() >= 4 && d.getUTCMonth() <= 7 && rand() < 0.6) continue; // quieter summer
  const category = pick([["game_night", 40], ["workshop", 20], ["social", 14], ["meeting", 14], ["game_jam", 6], ["partner", 6]]);
  const list = titles[category];
  events.push({ id: uuid(10_000 + events.length), t, category, title: list[Math.floor(rand() * list.length)] });
}
for (const e of events) {
  await db.query("insert into public.events (id, title, starts_at, ends_at, category) values ($1, $2, $3, $4, $5)", [
    e.id, e.title, iso(e.t), iso(e.t + 2 * 3600_000), e.category,
  ]);
}

// Check-ins and RSVPs.
const attendance = [];
const rsvps = [];
const size = { game_night: 1, workshop: 0.55, social: 0.75, meeting: 0.5, game_jam: 0.45, partner: 0.6 };
for (const e of events) {
  const eligible = members.filter((m) => m.created <= e.t + 3 * 3600_000);
  const goers = eligible.filter((m) => rand() < (0.08 + m.loyalty * 0.5) * size[e.category]);
  for (const m of goers) {
    const offset = pick([[-12, 14], [4, 50], [14, 18], [24, 8], [42, 6], [70, 3]]) + (rand() - 0.5) * 8;
    attendance.push([e.id, m.id, iso(e.t + offset * 60_000)]);
    if (e.t > Date.UTC(2026, 0, 1) && rand() < 0.65) rsvps.push([e.id, m.id]);
  }
  if (e.t > Date.UTC(2026, 0, 1)) {
    for (const m of eligible) if (!goers.includes(m) && rand() < 0.04) rsvps.push([e.id, m.id]); // no-shows
  }
}
const values = (rows) => rows.map((r) => `(${r.map(sql).join(", ")})`).join(",");
await db.exec(`insert into public.attendance (event_id, user_id, checked_in_at) values ${values(attendance)}`);
await db.exec(`insert into public.event_rsvps (event_id, user_id) values ${values(rsvps)}`);

// The real function, as the demo officer.
await db.query("select set_config('request.jwt.claims', $1, false)", [
  JSON.stringify({ sub: members[0].id, email: "demo1@umich.edu", role: "authenticated" }),
]);
await db.exec("set role authenticated");
const out = { generated_at: new Date(now).toISOString() };
for (const { id } of RANGES) {
  const b = rangeBounds(id, new Date(now));
  const { rows } = await db.query("select public.officer_analytics($1, $2) as r", [b.from?.toISOString() ?? null, b.to.toISOString()]);
  out[id] = rows[0].r;
}
await db.close();

writeFileSync(join(root, ".analytics-demo.json"), JSON.stringify(out));
console.log(
  `Demo: ${members.length} members, ${events.length} events, ${attendance.length} check-ins, ${rsvps.length} RSVPs (made up).\n` +
    "Wrote .analytics-demo.json. With `npm run dev`, open /officer/analytics?demo=1",
);
