// ZIP writer for the officer backup. Run: npm test
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { crc32, makeZip } from "../src/lib/zip.ts";

const hasUnzip = (() => {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("zip", () => {
  it("computes CRC-32", () => {
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
    assert.equal(crc32(new Uint8Array()), 0);
  });

  it("writes headers and a central directory for each file", () => {
    const zip = makeZip([{ name: "a.csv", data: "x,y\r\n" }, { name: "b.txt", data: "hé" }], new Date(2026, 10, 25, 12, 30, 10));
    const v = new DataView(zip.buffer);
    assert.equal(v.getUint32(0, true), 0x04034b50);
    const end = zip.length - 22;
    assert.equal(v.getUint32(end, true), 0x06054b50);
    assert.equal(v.getUint16(end + 10, true), 2, "two entries");
    const cdOffset = v.getUint32(end + 16, true);
    assert.equal(v.getUint32(cdOffset, true), 0x02014b50);
  });

  it("opens with the system unzip, contents intact", { skip: !hasUnzip && "no unzip on this machine" }, () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-test-"));
    try {
      const big = "row,\"quoted, value\"\r\n".repeat(5000);
      const file = join(dir, "t.zip");
      writeFileSync(file, makeZip([{ name: "members.csv", data: big }, { name: "README.txt", data: "Ünïcode ✓" }]));
      execFileSync("unzip", ["-tq", file]);
      assert.equal(execFileSync("unzip", ["-p", file, "members.csv"]).toString(), big);
      assert.equal(execFileSync("unzip", ["-p", file, "README.txt"]).toString(), "Ünïcode ✓");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
