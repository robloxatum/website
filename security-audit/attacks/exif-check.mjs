// Does an uploaded cover keep its EXIF/GPS block on the public URL? LOCAL Supabase only.
// Usage: node security-audit/attacks/exif-check.mjs <path-to-synthetic.jpg>
import { spawnSync, execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { isLocalUrl } from "../../src/lib/e2e.ts";
const r = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
const st = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
if (!isLocalUrl(st.API_URL)) process.exit(1);
const PW = randomBytes(18).toString("base64url"), RUN = randomUUID().slice(0, 6), ns = { auth: { persistSession: false } };
const admin = createClient(st.API_URL, st.SERVICE_ROLE_KEY, ns);
const email = `aud3exif${RUN}@umich.edu`;
const { data: u } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
await admin.from("profiles").update({ is_officer: true, onboarded_at: new Date().toISOString() }).eq("id", u.user.id);
const c = createClient(st.API_URL, st.PUBLISHABLE_KEY, ns);
await c.auth.signInWithPassword({ email, password: PW });
const bytes = readFileSync(process.argv[2]);
const name = `covers/${randomUUID()}.jpg`;
// Same call as EventForm.uploadImage: the File goes up unchanged.
const up = await c.storage.from("event-flyers").upload(name, bytes, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
const got = Buffer.from(await (await fetch(`${st.API_URL}/storage/v1/object/public/event-flyers/${name}`)).arrayBuffer());
const has = (s) => got.includes(Buffer.from(s));
console.log(JSON.stringify({ uploaded: !up.error, sameBytes: got.equals(bytes), exifHeader: has("Exif\0\0"), make: has("SyntheticCam"), model: has("AUD3-Model"), gpsRef: got.includes(Buffer.from([0x88, 0x25])) || got.includes(Buffer.from([0x25, 0x88])) }));
await admin.storage.from("event-flyers").remove([name]);
execFileSync("docker", ["exec", "-i", "supabase_db_website", "psql", "-U", "postgres", "-c", "delete from auth.users where email like 'aud3%';"]);
