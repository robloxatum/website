// Small helpers for the hand-drawn SVG charts (officer analytics). No runtime
// imports: the unit tests run this file directly with Node.

/** A round number at or above `value` for the top of a chart's axis (1, 2, 2.5, 5 × 10ⁿ). */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  for (const step of [1, 2, 2.5, 5, 10]) {
    const nice = step * base;
    if (nice >= value) return exp >= 0 ? nice : Number(nice.toPrecision(3));
  }
  return 10 * base;
}

/** Evenly spaced gridline values from 0 to `max` (inclusive), whole numbers only: 4, 5 or 2 steps. */
export function axisTicks(max: number): number[] {
  for (const count of [4, 5, 2]) {
    const ticks = Array.from({ length: count + 1 }, (_, i) => (i * max) / count);
    if (ticks.every(Number.isInteger)) return ticks;
  }
  return [0, max];
}

export type Point = { x: number; y: number };

/**
 * A smooth SVG path through the points (monotone cubic, Fritsch–Carlson): it
 * never overshoots between two points, so the curve can't dip below zero or
 * invent a peak the data doesn't have. Points must be sorted by x.
 */
export function smoothPath(points: Point[]): string {
  const n = points.length;
  if (n === 0) return "";
  const f = (v: number) => Number(v.toFixed(2));
  if (n === 1) return `M${f(points[0].x)},${f(points[0].y)}`;
  if (n === 2) return `M${f(points[0].x)},${f(points[0].y)}L${f(points[1].x)},${f(points[1].y)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push(dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i]);
  }
  // Tangent at each point: zero at a local peak/valley, else a weighted mean.
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) m.push(0);
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m.push((w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]));
    }
  }
  m.push(slope[n - 2]);

  let d = `M${f(points[0].x)},${f(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const h = dx[i] / 3;
    d += `C${f(p.x + h)},${f(p.y + m[i] * h)} ${f(q.x - h)},${f(q.y - m[i + 1] * h)} ${f(q.x)},${f(q.y)}`;
  }
  return d;
}

/**
 * Which of `n` items get an x-axis label: at most `max`, always the first and
 * the last, evenly spaced in between (so labels never crowd each other).
 */
export function labelIndexes(n: number, max: number): number[] {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  if (max <= 1) return [n - 1];
  const out = new Set<number>();
  for (let i = 0; i < max; i++) out.add(Math.round((i * (n - 1)) / (max - 1)));
  return [...out];
}
