import { admin, createUser, PASSWORD, SEEDED } from "./support/db";

/**
 * Seeds the fixed users, after checking that the server under test really was
 * built against the local database: its CSP lists exactly which Supabase the
 * browser may talk to.
 */
export default async function globalSetup() {
  const res = await fetch("http://localhost:3200/");
  const csp = res.headers.get("content-security-policy") ?? "";
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!csp.includes(supabase) || /supabase\.co\b/.test(csp)) {
    throw new Error(`The server on :3200 isn't the local E2E build (CSP: ${csp.slice(0, 200)}…). Use npm run test:e2e.`);
  }
  const probe = await fetch("http://localhost:3200/auth/test-sign-in", { redirect: "manual" });
  if (probe.status === 404 && (await probe.text()).includes("Not found")) {
    throw new Error("Test sign-in is off: the server isn't running in E2E mode.");
  }

  // Already there (a run with --no-reset): keep them, with this run's password.
  const { data } = await admin.from("profiles").select("id, uniqname").in("uniqname", Object.values(SEEDED));
  if (data?.length) {
    for (const p of data) await admin.auth.admin.updateUserById(p.id, { password: PASSWORD });
    return;
  }

  await createUser({ uniqname: SEEDED.owner, fullName: "Olive Owner", nickname: "Olive", owner: true });
  await createUser({ uniqname: SEEDED.officer, fullName: "Oscar Officer", nickname: "Oscar", officer: true });
  await createUser({ uniqname: SEEDED.member, fullName: "Mia Member", nickname: "Mia" });
  await createUser({ uniqname: SEEDED.member2, fullName: "Max Member" });
}
