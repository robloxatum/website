/**
 * Isometric voxel cubes drawn in SVG. Fallback art until real artwork lands
 * in public/art/ (see src/content/art.ts).
 */

export const CUBE_TONES = {
  maize: ["#f7d64a", "#f0c413", "#c49a08"],
  blue: ["#2f6396", "#1c4570", "#11314f"],
  navy: ["#1f4b74", "#14375a", "#0c2741"],
  sky: ["#5d8fc0", "#3b6c9c", "#29527a"],
} as const;

export type CubeTone = keyof typeof CUBE_TONES;

/** One cube. (x, y) is the top corner of the top face; s is the edge length. */
export function Cube({ x, y, s, tone = "blue" }: { x: number; y: number; s: number; tone?: CubeTone }) {
  const [top, left, right] = CUBE_TONES[tone];
  const w = s * 0.866;
  const h = s * 0.5;
  return (
    <g>
      <polygon points={`${x},${y} ${x + w},${y + h} ${x},${y + 2 * h} ${x - w},${y + h}`} fill={top} />
      <polygon points={`${x - w},${y + h} ${x},${y + 2 * h} ${x},${y + 2 * h + s} ${x - w},${y + h + s}`} fill={left} />
      <polygon points={`${x},${y + 2 * h} ${x + w},${y + h} ${x + w},${y + h + s} ${x},${y + 2 * h + s}`} fill={right} />
    </g>
  );
}

type Placed = { x: number; y: number; s: number; tone: CubeTone; float?: "a" | "b" | "c" };

const floatClass = {
  a: "animate-float",
  b: "animate-float-slow [animation-delay:-3s]",
  c: "animate-float [animation-delay:-5s]",
};

/** A floating cluster of cubes. Decorative only. */
export function CubeCluster({
  cubes,
  viewBox,
  className = "",
}: {
  cubes: Placed[];
  viewBox: string;
  className?: string;
}) {
  return (
    <svg viewBox={viewBox} className={className} aria-hidden="true" focusable="false">
      {cubes.map((c, i) => (
        <g key={i} className={c.float ? `${floatClass[c.float]} [transform-box:fill-box]` : undefined}>
          <Cube x={c.x} y={c.y} s={c.s} tone={c.tone} />
        </g>
      ))}
    </svg>
  );
}

/** Small corner accent used on stat cards (mockup's cube corners). */
export function CornerCubes({ className = "" }: { className?: string }) {
  return (
    <CubeCluster
      className={className}
      viewBox="0 0 80 70"
      cubes={[
        { x: 52, y: 22, s: 20, tone: "navy" },
        { x: 34, y: 34, s: 16, tone: "blue" },
        { x: 64, y: 8, s: 12, tone: "maize" },
      ]}
    />
  );
}
