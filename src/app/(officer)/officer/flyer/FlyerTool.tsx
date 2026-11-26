"use client";

import {
  CalendarDays,
  Check,
  Copy,
  Download,
  FileCode2,
  Link2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import icon from "@/assets/brand/icon.png";
import { Alert } from "@/components/ui/Alert";
import { button, card, field, label } from "@/components/ui/styles";
import { shortlinks, type ShortLink } from "@/content/shortlinks";
import {
  analyticsPath,
  eventUrl,
  joinUrl,
  sanitizeLabel,
  shortlinkUrl,
} from "@/lib/flyer-links";
import { isShortlinkExpired } from "@/lib/shortlinks";
import { CLUB_TIME_ZONE } from "@/lib/time";
import { drawQr, qrSvg } from "./qr";

const expiryFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** An upcoming (or happening now) event in the "An event page" dropdown. */
export type FlyerEvent = {
  id: string;
  title: string;
  date: string;
  live: boolean;
};

/** "QR goes to" choices: the Join page, an event page, or a short link ("go:<slug>"). */
type Target = "join" | "event" | `go:${string}`;

/** When to use each "QR goes to" choice (shown under the dropdown). */
const TARGET_HELP: Record<"join" | "event" | "go", string> = {
  join: "For flyers and posters about the club in general. Opens our Join page. Use a different label for each flyer or spot to see which one people scanned.",
  event:
    "For a flyer about one event. Opens that event's page (when, where, add to calendar). Only upcoming events are listed. Add a label to see which flyer people scanned.",
  go: "For a link that changes or expires, like a sign-up form until a deadline. The QR stays the same while where it goes is changed in src/content/shortlinks.ts. It's also shorter, so the QR is simpler to scan.",
};

function ShortlinkDetails({ link }: { link: ShortLink }) {
  // Only rendered after the officer picks a short link, so this runs in the browser.
  const expired = isShortlinkExpired(link, new Date());
  const after =
    link.afterExpiry === "/" ? "the homepage (/)" : link.afterExpiry;
  return (
    <div className="space-y-3">
      {expired && (
        <Alert tone="warning" title="This short link has expired">
          Scans now go to {after}. To bring it back, change its expiresAt in
          src/content/shortlinks.ts.
        </Alert>
      )}
      <dl className="grid gap-x-4 gap-y-2 rounded-[10px] border border-line/60 bg-bg-2 p-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-fg-3">{expired ? "Went to" : "Goes to"}</dt>
        <dd className="font-mono break-all text-fg">{link.target}</dd>
        <dt className="text-fg-3">{expired ? "Expired" : "Until"}</dt>
        <dd className="text-fg">
          {expiryFmt.format(new Date(link.expiresAt))}
        </dd>
        <dt className="text-fg-3">Then</dt>
        <dd className="text-fg">{after}</dd>
        <dt className="text-fg-3">Analytics</dt>
        <dd className="font-mono break-all text-fg">
          {analyticsPath(link.target)}
        </dd>
      </dl>
    </div>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function FlyerTool({
  baseUrl,
  events,
}: {
  baseUrl: string;
  events: FlyerEvent[];
}) {
  const [raw, setRaw] = useState("");
  const [target, setTarget] = useState<Target>("join");
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [logo, setLogo] = useState<{
    img: HTMLImageElement;
    dataUrl: string;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const labelValue = sanitizeLabel(raw);
  const shortlink = target.startsWith("go:")
    ? (shortlinks.find((l) => `go:${l.slug}` === target) ?? null)
    : null;
  const event =
    target === "event" ? (events.find((e) => e.id === eventId) ?? null) : null;
  const help =
    TARGET_HELP[shortlink ? "go" : target === "event" ? "event" : "join"];
  // No link (and no QR) only when "An event page" is picked with no upcoming events.
  let url: string | null;
  let filename: string;
  if (shortlink) {
    url = shortlinkUrl(baseUrl, shortlink.slug);
    filename = `roblox-at-um-qr-go-${shortlink.slug}`;
  } else if (target === "event") {
    url = event ? eventUrl(baseUrl, event.id, labelValue) : null;
    filename = `roblox-at-um-qr-event-${sanitizeLabel(event?.title ?? "") || "event"}${labelValue ? `-${labelValue}` : ""}`;
  } else {
    url = joinUrl(baseUrl, labelValue);
    filename = `roblox-at-um-qr-${labelValue || "join"}`;
  }

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
    if (canvasRef.current && logo && url)
      drawQr(canvasRef.current, url, logo.img);
  }, [url, logo]);

  // Side by side only from xl: below that, next to the officer sidebar, the controls column is too narrow.
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className={`${card} space-y-5 p-5 sm:p-6`}>
        <div>
          <label htmlFor="flyer-link" className={label}>
            <Link2
              aria-hidden="true"
              className="mr-1.5 inline size-4 align-[-3px] text-maize"
            />
            QR goes to
          </label>
          <select
            id="flyer-link"
            value={target}
            onChange={(e) => setTarget(e.target.value as Target)}
            aria-describedby="flyer-link-help"
            className={field}
          >
            <option value="join">Join page, with a label</option>
            <option value="event">An event page</option>
            {shortlinks.map((l) => (
              <option key={l.slug} value={`go:${l.slug}`}>
                Short link: /go/{l.slug}
              </option>
            ))}
          </select>
          <p id="flyer-link-help" className="mt-1.5 text-sm text-fg-2">
            {help}
          </p>
        </div>

        {target === "event" &&
          (events.length ? (
            <div>
              <label htmlFor="flyer-event" className={label}>
                <CalendarDays
                  aria-hidden="true"
                  className="mr-1.5 inline size-4 align-[-3px] text-maize"
                />
                Event
              </label>
              <select
                id="flyer-event"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className={field}
              >
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} — {e.date}
                    {e.live ? " (happening now)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Alert tone="info" title="No upcoming events">
              Add one on the Events page, then come back here to make its QR
              code.
            </Alert>
          ))}

        {shortlink ? (
          <ShortlinkDetails link={shortlink} />
        ) : (
          (target === "join" || event) && (
            <div>
              <label htmlFor="flyer-label" className={label}>
                Label{" "}
                <span className="font-normal text-fg-3">
                  (where this flyer goes)
                </span>
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
                Optional. Lowercase letters, numbers, - and _. Visits show up in
                Vercel Analytics as{" "}
                <code className="rounded bg-bg-2 px-1.5 py-0.5 break-all text-fg">
                  {event ? `/events/${event.id}` : "/join"}/src/
                  {labelValue || "<label>"}
                </code>
                .
              </p>
            </div>
          )
        )}

        {url && (
          <>
            <div>
              <p className={label}>Link in the QR code</p>
              <div className="flex items-center gap-2">
                <code
                  className="min-w-0 flex-1 truncate rounded-[10px] border border-line/60 bg-bg-2 px-4 py-3 text-sm text-fg"
                  title={url}
                >
                  {url}
                </code>
                <button
                  type="button"
                  aria-label="Copy link"
                  className={button({
                    variant: "secondary",
                    className: "min-h-12 shrink-0",
                  })}
                  onClick={async () => {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? (
                    <Check aria-hidden="true" className="text-ok" />
                  ) : (
                    <Copy aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">
                    {copied ? "Copied" : "Copy"}
                  </span>
                </button>
              </div>
            </div>

            {/* Side by side when there's room, otherwise one per row (never cut off). */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!logo}
                className={button({
                  size: "lg",
                  className: "min-w-0 flex-1 basis-56",
                })}
                onClick={() =>
                  canvasRef.current?.toBlob(
                    (b) => b && download(b, `${filename}.png`),
                    "image/png",
                  )
                }
              >
                <Download aria-hidden="true" />
                PNG (2400 px)
              </button>
              <button
                type="button"
                disabled={!logo}
                className={button({
                  variant: "secondary",
                  size: "lg",
                  className: "min-w-0 flex-1 basis-56",
                })}
                onClick={() =>
                  logo &&
                  download(
                    new Blob([qrSvg(url, logo.dataUrl)], {
                      type: "image/svg+xml",
                    }),
                    `${filename}.svg`,
                  )
                }
              >
                <FileCode2 aria-hidden="true" />
                SVG (for print)
              </button>
            </div>
            <p className="text-sm text-fg-3">
              Print at least 2.5 cm (1 in) wide with a white margin around it.
              Test-scan it with a phone before printing a batch.
            </p>
          </>
        )}
      </div>

      <div className={`${card} p-5 sm:p-6`}>
        <p className={label}>Preview</p>
        <div className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-white">
          {/* Always mounted (the PNG download reads it); hidden while there's no link. */}
          <canvas
            ref={canvasRef}
            data-testid="flyer-qr"
            role="img"
            aria-label={url ? `QR code for ${url}` : "No QR code yet"}
            className={`block size-full max-w-full ${url ? "" : "hidden"}`}
          />
          {!url && (
            <p className="flex size-full items-center justify-center p-6 text-center text-sm text-gray-700">
              Pick an event to see its QR code.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
