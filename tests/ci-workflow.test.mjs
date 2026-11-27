// Security audit 3, L-6: the CI workflow's token is read-only and every action
// is pinned to a full commit SHA (a tag can be moved to other code). Run: npm test
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const dir = new URL("../.github/workflows/", import.meta.url);
const workflows = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));

describe("GitHub Actions workflows", () => {
  it("exist", () => assert.ok(workflows.length > 0));
  for (const f of workflows) {
    const yml = readFileSync(new URL(f, dir), "utf8");
    it(`${f}: token is read-only`, () => {
      assert.match(yml, /^permissions:\n {2}contents: read\s*$/m);
      assert.doesNotMatch(yml, /:\s*write\b/, "no write permissions");
      assert.doesNotMatch(yml, /pull_request_target/, "no pull_request_target trigger");
    });
    it(`${f}: every action is pinned to a commit SHA`, () => {
      const uses = [...yml.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]);
      assert.ok(uses.length > 0);
      for (const u of uses) assert.match(u, /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/, u);
    });
  }
});
