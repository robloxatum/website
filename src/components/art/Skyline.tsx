/**
 * A simple voxel campus skyline with a tall clock tower (inspired by a
 * carillon tower, not a copy of any real building). Pure SVG fallback art.
 */

const WINDOW = "#f0c413";

function Windows({ x, y, cols, rows, gap = 14, size = 6, seed = 1 }: {
  x: number; y: number; cols: number; rows: number; gap?: number; size?: number; seed?: number;
}) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Deterministic "random" lit windows.
      const lit = ((r * 7 + c * 13 + seed * 5) % 5) < 2;
      out.push(
        <rect key={`${r}-${c}`} x={x + c * gap} y={y + r * gap} width={size} height={size + 2}
          fill={WINDOW} opacity={lit ? 0.75 : 0.12} />,
      );
    }
  }
  return <>{out}</>;
}

function Tree({ x, y, s = 10 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <rect x={x + s} y={y + s * 3} width={s} height={s * 2} fill="#0b2238" />
      <rect x={x} y={y + s} width={s * 3} height={s * 2} fill="#174a3f" />
      <rect x={x + s * 0.5} y={y} width={s * 2} height={s * 1.2} fill="#1e5e4f" />
    </g>
  );
}

export function VoxelSkyline({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sky-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#143a5e" />
          <stop offset="1" stopColor="#0c2741" />
        </linearGradient>
        <linearGradient id="sky-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f2f4d" />
          <stop offset="1" stopColor="#081d31" />
        </linearGradient>
      </defs>

      {/* Pixel clouds */}
      <g fill="#1d4a73" opacity="0.55">
        <rect x="70" y="40" width="80" height="16" /><rect x="90" y="28" width="40" height="12" />
        <rect x="430" y="58" width="96" height="16" /><rect x="456" y="44" width="48" height="14" />
        <rect x="250" y="20" width="56" height="12" />
      </g>

      {/* Far buildings */}
      <g fill="url(#sky-far)">
        <rect x="0" y="230" width="90" height="130" />
        <rect x="80" y="200" width="70" height="160" />
        <rect x="470" y="210" width="80" height="150" />
        <rect x="540" y="240" width="100" height="120" />
      </g>

      {/* Clock tower */}
      <g>
        <rect x="300" y="78" width="74" height="282" fill="#163e63" />
        <rect x="374" y="78" width="16" height="282" fill="#0f2f4d" />
        <rect x="292" y="66" width="106" height="16" fill="#1d4a73" />
        <rect x="306" y="40" width="78" height="28" fill="#163e63" />
        <rect x="318" y="24" width="54" height="18" fill="#1d4a73" />
        <rect x="332" y="10" width="26" height="16" fill="#163e63" />
        {/* clock face */}
        <rect x="321" y="96" width="32" height="32" fill="#0c2741" />
        <rect x="325" y="100" width="24" height="24" fill="#f0c413" opacity="0.85" />
        <rect x="336" y="104" width="3" height="10" fill="#0c2741" />
        <rect x="336" y="111" width="9" height="3" fill="#0c2741" />
        <Windows x={312} y={150} cols={4} rows={10} gap={14} size={6} seed={2} />
      </g>

      {/* Near buildings */}
      <g fill="url(#sky-near)">
        <rect x="140" y="236" width="130" height="124" />
        <rect x="160" y="218" width="90" height="20" />
        <rect x="400" y="246" width="110" height="114" />
        <rect x="414" y="230" width="82" height="18" />
      </g>
      <Windows x={156} y={252} cols={8} rows={6} gap={14} size={6} seed={3} />
      <Windows x={414} y={262} cols={6} rows={5} gap={15} size={6} seed={4} />
      <Windows x={14} y={246} cols={5} rows={7} gap={14} size={5} seed={5} />
      <Windows x={558} y={256} cols={5} rows={6} gap={15} size={5} seed={6} />

      {/* Trees and ground */}
      <Tree x={110} y={300} s={10} />
      <Tree x={270} y={296} s={11} />
      <Tree x={384} y={300} s={10} />
      <Tree x={520} y={304} s={9} />
      <rect x="0" y="346" width="640" height="14" fill="#081d31" />
    </svg>
  );
}
