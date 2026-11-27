import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Security audit 3, L-8: a POST naming a "use cache" function's ID in Next-Action
// must not run it (it would let anyone call lib/roblox.ts's Roblox lookups with
// their own arguments, signed out and without the lookup limit). proxy.ts
// refuses it with a 404, on every path, while real Server Actions keep working.

type Ref = { exportedName: string; filename: string; workers: Record<string, unknown> };
const refs = Object.entries(JSON.parse(readFileSync(".next-e2e/server/server-reference-manifest.json", "utf8")).node as Record<string, Ref>);
const cacheFns = refs.filter(([, r]) => r.exportedName.startsWith("$$RSC_SERVER_CACHE"));

function post(request: import("@playwright/test").APIRequestContext, path: string, id: string, args: unknown[]) {
  return request.post(path, {
    headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: "http://localhost:3200" },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
}

test.describe("Server Action IDs", () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "HTTP only: once is enough"));

  test("every \"use cache\" function is refused as an action, signed out", async ({ request }) => {
    expect(cacheFns.length).toBeGreaterThan(0);
    const roblox = cacheFns.filter(([, r]) => r.filename.endsWith("lib/roblox.ts"));
    expect(roblox.length).toBe(3);
    for (const [id, ref] of cacheFns) {
      // /about renders the Roblox avatars; /events/x.png is a page path the
      // proxy's main matcher skips (it ends in .png).
      for (const path of ["/about", "/events/aud3.png", "/"]) {
        const args = ref.filename.endsWith("roblox.ts") ? [Array.from({ length: 500 }, (_, i) => `aud3_${i}`)] : [];
        const res = await post(request, path, id, args);
        expect(res.status(), `${ref.exportedName} (${ref.filename}) on ${path}`).toBe(404);
        expect(await res.text()).not.toContain('"a":');
      }
    }
  });

  test("real Server Actions still run (signed out: checkIn answers not_signed_in)", async ({ request }) => {
    const [id] = refs.find(([, r]) => r.exportedName === "checkIn")!;
    const res = await post(request, "/checkin", id, ["ABCDE"]);
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("not_signed_in");
  });
});
