// Security audit 3, L-8: "use cache" functions must not be callable as Server Actions.
// proxy.ts refuses a Next-Action header that names one. Run: npm test
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { isCacheFunctionReference } from "../src/lib/server-reference.ts";

const require = createRequire(import.meta.url);
// Next's own decoder of the ID's info byte: if an upgrade changes the format, these tests fail.
const { extractInfoFromServerReferenceId, SERVER_REFERENCE_ID_LENGTH } = require("next/dist/shared/lib/server-reference-info.js");

const hex = (firstByte) => firstByte.toString(16).padStart(2, "0") + "a1".repeat(20);

describe("isCacheFunctionReference", () => {
  it("agrees with Next's decoder for every possible info byte", () => {
    assert.equal(SERVER_REFERENCE_ID_LENGTH, 42);
    for (let b = 0; b < 256; b++) {
      const id = hex(b);
      assert.equal(isCacheFunctionReference(id), extractInfoFromServerReferenceId(id).type === "use-cache", id);
    }
  });

  it("is false for missing or malformed headers (left to Next, which refuses them)", () => {
    for (const v of [null, undefined, "", "80", "zz" + "a1".repeat(20), hex(0x80) + "0", hex(0x80).slice(1)]) {
      assert.equal(isCacheFunctionReference(v), false, String(v));
    }
  });

  it("accepts upper-case hex like Next does", () => {
    assert.equal(isCacheFunctionReference(hex(0xc0).toUpperCase()), true);
  });

  // With a build present (npm run build or npm run test:e2e), check the real IDs:
  // every "use cache" function is refused and every Server Action is let through.
  for (const dir of [".next", ".next-e2e"]) {
    const file = `${dir}/server/server-reference-manifest.json`;
    it(`classifies every ID in ${file} correctly`, { skip: !existsSync(file) && `no ${dir} build` }, () => {
      const refs = Object.entries(JSON.parse(readFileSync(file, "utf8")).node);
      assert.ok(refs.length > 0);
      let cache = 0, actions = 0;
      for (const [id, ref] of refs) {
        const isCache = String(ref.exportedName).startsWith("$$RSC_SERVER_CACHE");
        assert.equal(isCacheFunctionReference(id), isCache, `${ref.exportedName} in ${ref.filename}`);
        if (isCache) cache++;
        else actions++;
      }
      assert.ok(cache > 0 && actions > 0, `cache=${cache} actions=${actions}`);
    });
  }
});

describe("proxy.ts runs the check on every path that names an action", () => {
  const src = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
  it("refuses before touching the session", () => {
    const check = src.indexOf("isCacheFunctionReference(request.headers.get(\"next-action\"))");
    assert.ok(check > 0, "check missing");
    assert.ok(check < src.indexOf("createServerClient("), "check must come first");
  });
  it("has a matcher entry for the next-action header on any path", () => {
    assert.match(src, /\{\s*source:\s*"\/:path\*",\s*has:\s*\[\{\s*type:\s*"header",\s*key:\s*"next-action"\s*\}\]\s*\}/);
  });
});
