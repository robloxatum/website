// Can a checked-in member SEND a broadcast that other members/officers receive on
// a private channel (game:<id> or attendance:<id>)? LOCAL Supabase only.
import { spawnSync, execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { isLocalUrl } from "../../src/lib/e2e.ts";
const r = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
const st = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
if (!isLocalUrl(st.API_URL)) process.exit(1);
const PUB = st.PUBLISHABLE_KEY, PW = randomBytes(18).toString("base64url"), RUN = randomUUID().slice(0, 6);
const ns = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(st.API_URL, st.SERVICE_ROLE_KEY, ns);
async function user(tag, officer = false) {
  const email = `aud3${tag}${RUN}@umich.edu`;
  const { data } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  await admin.from("profiles").update({ onboarded_at: new Date().toISOString(), is_officer: officer }).eq("id", data.user.id);
  const c = createClient(st.API_URL, PUB, ns);
  const { data: s } = await c.auth.signInWithPassword({ email, password: PW });
  await c.realtime.setAuth(s.session.access_token);
  return c;
}
const { data: ev } = await admin.from("events").insert({ title: `AUD3 RT ${RUN}`, starts_at: new Date(Date.now() - 6e5).toISOString(), ends_at: new Date(Date.now() + 6e6).toISOString(), checkin_open: true }).select("id").single();
const { data: code } = await admin.from("event_codes").select("code").eq("event_id", ev.id).single();
const sender = await user("snd"), listener = await user("lst"), officer = await user("ofc", true);
await sender.rpc("check_in", { p_code: code.code });
await listener.rpc("check_in", { p_code: code.code });
const join = (c, topic, got) => new Promise((res) => {
  const ch = c.channel(topic, { config: { private: true, broadcast: { ack: true } } });
  ch.on("broadcast", { event: "*" }, (m) => got.push(m));
  ch.subscribe((s) => (s === "SUBSCRIBED" || s === "CHANNEL_ERROR") && res([ch, s]));
  setTimeout(() => res([ch, "timeout"]), 8000);
});
for (const topic of [`game:${ev.id}`]) {
  const gotL = [], gotO = [];
  const [, sl] = await join(listener, topic, gotL);
  const [, so] = await join(officer, topic, gotO);
  const [chS, ss] = await join(sender, topic, []);
  const ack = await chS.send({ type: "broadcast", event: "changed", payload: { spoof: true } });
  await new Promise((r) => setTimeout(r, 2500));
  console.log(JSON.stringify({ topic: topic.split(":")[0], joins: { sender: ss, listener: sl, officer: so }, senderAck: ack, listenerReceived: gotL.length, officerReceived: gotO.length }));
}
// attendance:<id>: a member can't join; can they send without joining (REST broadcast endpoint)?
{
  const tok = (await sender.auth.getSession()).data.session.access_token;
  const gotO = [];
  await join(officer, `attendance:${ev.id}`, gotO);
  const res = await fetch(`${st.API_URL}/realtime/v1/api/broadcast`, { method: "POST", headers: { apikey: PUB, Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ topic: `attendance:${ev.id}`, event: "count", payload: { count: 9999 }, private: true }] }) });
  await new Promise((r) => setTimeout(r, 2500));
  console.log(JSON.stringify({ topic: "attendance (REST send by member)", httpStatus: res.status, officerReceived: gotO.length, payloads: gotO.map((m) => m.payload) }));
  const res2 = await fetch(`${st.API_URL}/realtime/v1/api/broadcast`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ topic: `attendance:${ev.id}`, event: "count", payload: { count: 8888 }, private: false }] }) });
  await new Promise((r) => setTimeout(r, 1500));
  console.log(JSON.stringify({ topic: "attendance (REST send by anon, public flag)", httpStatus: res2.status, officerReceivedTotal: gotO.length }));
}
await admin.from("events").delete().eq("id", ev.id);
execFileSync("docker", ["exec", "-i", "supabase_db_website", "psql", "-U", "postgres", "-c", "delete from auth.users where email like 'aud3%';"]);
process.exit(0);
