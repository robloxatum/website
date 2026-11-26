// SVG chart helpers (officer analytics). Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { axisTicks, labelIndexes, niceMax, smoothPath } from "../src/lib/chart.ts";

describe("niceMax", () => {
  it("rounds up to a readable axis top", () => {
    assert.equal(niceMax(0), 1);
    assert.equal(niceMax(1), 1);
    assert.equal(niceMax(7), 10);
    assert.equal(niceMax(18), 20);
    assert.equal(niceMax(21), 25);
    assert.equal(niceMax(65), 100);
    assert.equal(niceMax(240), 250);
  });
});

describe("axisTicks", () => {
  it("splits the axis into whole numbers", () => {
    assert.deepEqual(axisTicks(100), [0, 25, 50, 75, 100]);
    assert.deepEqual(axisTicks(20), [0, 5, 10, 15, 20]);
  });
  it("uses 5 or 2 steps, or just the ends, when 4 steps aren't whole", () => {
    assert.deepEqual(axisTicks(1), [0, 1]);
    assert.deepEqual(axisTicks(10), [0, 2, 4, 6, 8, 10]);
    assert.deepEqual(axisTicks(25), [0, 5, 10, 15, 20, 25]);
  });
});

describe("smoothPath", () => {
  it("handles 0, 1 and 2 points", () => {
    assert.equal(smoothPath([]), "");
    assert.equal(smoothPath([{ x: 5, y: 5 }]), "M5,5");
    assert.equal(smoothPath([{ x: 0, y: 10 }, { x: 10, y: 0 }]), "M0,10L10,0");
  });

  it("passes through every point and never overshoots past its neighbours", () => {
    const pts = [{ x: 0, y: 90 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 100 }, { x: 40, y: 50 }];
    const d = smoothPath(pts);
    for (const p of pts) assert.ok(d.includes(`${p.x},${p.y}`), `goes through ${p.x},${p.y}`);
    // Every control point stays within its segment's y-range: no dip below 0 or above 100.
    const nums = [...d.matchAll(/C([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+)/g)];
    assert.equal(nums.length, pts.length - 1);
    nums.forEach((c, i) => {
      const lo = Math.min(pts[i].y, pts[i + 1].y);
      const hi = Math.max(pts[i].y, pts[i + 1].y);
      for (const y of [Number(c[2]), Number(c[4])]) assert.ok(y >= lo - 1e-9 && y <= hi + 1e-9, `segment ${i}: ${y} in [${lo}, ${hi}]`);
    });
  });
});

describe("labelIndexes", () => {
  it("labels everything when it fits", () => {
    assert.deepEqual(labelIndexes(3, 6), [0, 1, 2]);
    assert.deepEqual(labelIndexes(0, 6), []);
  });
  it("keeps the first and last, evenly spaced", () => {
    assert.deepEqual(labelIndexes(36, 5), [0, 9, 18, 26, 35]);
    assert.deepEqual(labelIndexes(10, 1), [9]);
  });
});
