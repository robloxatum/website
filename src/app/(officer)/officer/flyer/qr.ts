import QRCode from "qrcode";

/** Flyer QR rendering shared by the PNG and SVG downloads. */
export const QR_DARK = "#081f40";
export const QR_LIGHT = "#ffffff";
const QUIET = 4; // modules of white border (QR spec minimum)
const LOGO_TILE = 0.24; // white tile behind the logo, as a fraction of the code width
const LOGO = 0.19; // the logo itself

function matrix(text: string) {
  // Highest error correction (H, ~30%) so the center logo never breaks scanning.
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  return { size: qr.modules.size, dark: (r: number, c: number) => qr.modules.get(r, c) === 1 };
}

function geometry(size: number, px: number) {
  const total = size + QUIET * 2;
  const unit = px / total;
  const codePx = size * unit;
  const tile = codePx * LOGO_TILE;
  const logo = codePx * LOGO;
  return { total, unit, tile, logo, center: px / 2 };
}

/** Draws the QR (with logo) onto a canvas of px × px. */
export function drawQr(canvas: HTMLCanvasElement, text: string, logo: HTMLImageElement | null, px = 2400) {
  const { size, dark } = matrix(text);
  const g = geometry(size, px);
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = QR_LIGHT;
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = QR_DARK;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!dark(r, c)) continue;
      // Snap to whole pixels so modules never leave hairline gaps.
      const x = Math.round((c + QUIET) * g.unit);
      const y = Math.round((r + QUIET) * g.unit);
      ctx.fillRect(x, y, Math.round((c + QUIET + 1) * g.unit) - x, Math.round((r + QUIET + 1) * g.unit) - y);
    }
  }
  if (logo) {
    ctx.fillStyle = QR_LIGHT;
    const t = g.tile;
    ctx.beginPath();
    ctx.roundRect(g.center - t / 2, g.center - t / 2, t, t, t * 0.18);
    ctx.fill();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(logo, g.center - g.logo / 2, g.center - g.logo / 2, g.logo, g.logo);
  }
}

/** Same QR as an SVG document (vector modules; logo embedded as a data URL). */
export function qrSvg(text: string, logoDataUrl: string | null) {
  const { size, dark } = matrix(text);
  const total = size + QUIET * 2;
  const codeW = size;
  const tile = codeW * LOGO_TILE;
  const logo = codeW * LOGO;
  const c = total / 2;
  let path = "";
  for (let r = 0; r < size; r++) {
    for (let col = 0; col < size; col++) {
      if (dark(r, col)) path += `M${col + QUIET} ${r + QUIET}h1v1h-1z`;
    }
  }
  const logoEls = logoDataUrl
    ? `<rect x="${c - tile / 2}" y="${c - tile / 2}" width="${tile}" height="${tile}" rx="${tile * 0.18}" fill="${QR_LIGHT}"/>` +
      `<image href="${logoDataUrl}" x="${c - logo / 2}" y="${c - logo / 2}" width="${logo}" height="${logo}"/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="2400" height="2400" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${QR_LIGHT}"/>` +
    `<path d="${path}" fill="${QR_DARK}"/>` +
    logoEls +
    `</svg>`
  );
}
