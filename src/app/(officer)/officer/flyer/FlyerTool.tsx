"use client";

import { Check, Copy, Download, FileCode2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import icon from "@/assets/brand/icon.png";
import { button, card, field, label } from "@/components/ui/styles";
import { drawQr, joinUrl, qrSvg, sanitizeLabel } from "./qr";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function FlyerTool({ baseUrl }: { baseUrl: string }) {
  const [raw, setRaw] = useState("");
  const [copied, setCopied] = useState(false);
  const [logo, setLogo] = useState<{ img: HTMLImageElement; dataUrl: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const labelValue = sanitizeLabel(raw);
  const url = joinUrl(baseUrl, labelValue);
  const filename = `roblox-at-um-qr-${labelValue || "join"}`;

  // Load the square logo once (as an <img> for the canvas and a data URL for the SVG).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const blob = await (await fetch(icon.src)).blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
      });
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      if (!cancelled) setLogo({ img, dataUrl });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The preview IS the 2400px download canvas, scaled down with CSS.
  useEffect(() => {
    if (canvasRef.current && logo) drawQr(canvasRef.current, url, logo.img);
  }, [url, logo]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className={`${card} space-y-5 p-5 sm:p-6`}>
        <div>
          <label htmlFor="flyer-label" className={label}>
            Label <span className="font-normal text-fg-3">(where this flyer goes)</span>
          </label>
          <input
            id="flyer-label"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. flyer-winter27 or diag-board"
            aria-describedby="flyer-label-help"
            className={field}
          />
          <p id="flyer-label-help" className="mt-1.5 text-sm text-fg-2">
            Lowercase letters, numbers, - and _. Visits show up in Vercel Analytics as{" "}
            <code className="rounded bg-bg-2 px-1.5 py-0.5 text-fg">/join/src/{labelValue || "<label>"}</code>.
          </p>
        </div>

        <div>
          <p className={label}>Link in the QR code</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[10px] border border-line/60 bg-bg-2 px-4 py-3 text-sm text-fg" title={url}>
              {url}
            </code>
            <button
              type="button"
              aria-label="Copy link"
              className={button({ variant: "secondary", className: "min-h-12 shrink-0" })}
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check aria-hidden="true" className="text-ok" /> : <Copy aria-hidden="true" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={!logo}
            className={button({ size: "lg", full: true })}
            onClick={() => canvasRef.current?.toBlob((b) => b && download(b, `${filename}.png`), "image/png")}
          >
            <Download aria-hidden="true" />
            PNG (2400 px)
          </button>
          <button
            type="button"
            disabled={!logo}
            className={button({ variant: "secondary", size: "lg", full: true })}
            onClick={() => logo && download(new Blob([qrSvg(url, logo.dataUrl)], { type: "image/svg+xml" }), `${filename}.svg`)}
          >
            <FileCode2 aria-hidden="true" />
            SVG (for print)
          </button>
        </div>
        <p className="text-sm text-fg-3">
          Print at least 2.5 cm (1 in) wide with a white margin around it. Test-scan it with a phone before printing a
          batch.
        </p>
      </div>

      <div className={`${card} p-5 sm:p-6`}>
        <p className={label}>Preview</p>
        <div className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-white">
          <canvas
            ref={canvasRef}
            data-testid="flyer-qr"
            role="img"
            aria-label={`QR code for ${url}`}
            className="block size-full max-w-full"
          />
        </div>
      </div>
    </div>
  );
}
