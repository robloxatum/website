"use client";

import { ImageUp, RotateCcw, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { button, label } from "@/components/ui/styles";
import { type Cover, coverFileError, coverSizeError, flyerUrl } from "@/lib/flyers";

/**
 * Optional cover image on the event form, previewed in the same 2:1 crop the
 * event cards use. The file input is named "cover_file"; the form's action
 * uploads it to Storage before saving (see EventForm). "cover_action" tells
 * saveEvent to keep or remove the current cover.
 */
export function CoverField({ current, title }: { current: Cover | null; title?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  // The chosen file, its blob: preview URL and pixel size, set together once the file is read.
  const [picked, setPicked] = useState<{ file: File; preview: string; width: number; height: number } | null>(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const helpId = useId();
  const preview = picked?.preview ?? null;

  // Free each preview URL once it's replaced or the form goes away.
  useEffect(() => (preview ? () => URL.revokeObjectURL(preview) : undefined), [preview]);

  function clearFile() {
    setPicked(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onPick(f: File | null) {
    if (!f) return clearFile();
    const problem = coverFileError(f);
    if (problem) {
      setError(problem);
      return clearFile();
    }
    let width: number, height: number;
    try {
      const bitmap = await createImageBitmap(f);
      ({ width, height } = bitmap);
      bitmap.close();
    } catch {
      setError("That file isn't a readable JPG, PNG or WebP image.");
      return clearFile();
    }
    const sizeProblem = coverSizeError(width, height);
    setError(sizeProblem);
    if (sizeProblem) return clearFile();
    setPicked({ file: f, preview: URL.createObjectURL(f), width, height });
    setRemoved(false);
  }

  const showCurrent = current && !picked && !removed;
  const shown = picked ?? (showCurrent ? current : null);
  // Anything far from 2:1 loses a lot to the crop; say so (the preview shows exactly what).
  const ratio = shown ? shown.width / shown.height : 2;
  const cropNote =
    ratio < 1.8 ? "This image is taller than 2:1, so its top and bottom are cropped on cards." :
    ratio > 2.2 ? "This image is wider than 2:1, so its sides are cropped on cards." : null;

  return (
    <div>
      <p className={label} id={`${helpId}-label`}>
        Cover image <span className="font-normal text-fg-3">(optional)</span>
      </p>
      <p id={helpId} className="-mt-1 mb-3 text-sm text-fg-2">
        Shown on event cards and as the banner on the event page. 2:1, ideally 1600 × 800 (at least 1200 × 600).
        JPG, PNG or WebP, up to 5 MB. Without one, the event gets one of the club&apos;s default covers.
      </p>

      <input
        ref={inputRef}
        type="file"
        name="cover_file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-labelledby={`${helpId}-label`}
        aria-describedby={helpId}
        onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
      />
      <input type="hidden" name="cover_action" value={removed && !picked ? "remove" : "keep"} />

      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-line bg-bg-2/50 p-4 sm:flex-row sm:items-start">
        {shown && (
          <figure className="w-full shrink-0 sm:w-72">
            {/* Same box as a card's cover: 2:1, cropped from the center, soft bottom gradient. */}
            <div className="relative aspect-[2/1] overflow-hidden rounded-xl border border-line/60 bg-bg-2">
              {picked ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob: preview before upload
                <img src={picked.preview} alt="New cover preview" className="absolute inset-0 size-full object-cover object-center" />
              ) : (
                current && (
                  <Image
                    src={flyerUrl(current.path)}
                    alt={`Cover image for ${title || "this event"}`}
                    width={current.width}
                    height={current.height}
                    sizes="288px"
                    className="absolute inset-0 size-full object-cover object-center"
                  />
                )
              )}
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-[#0d2741]/75 to-transparent" />
            </div>
            <figcaption className="mt-2 text-xs text-fg-3">How it crops on an event card. Keep the subject centered; no text needed.</figcaption>
          </figure>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {picked && (
            <p className="text-sm text-fg">
              <span className="font-semibold break-all">{picked.file.name}</span>{" "}
              <span className="text-fg-3">
                ({picked.width} × {picked.height},{" "}
                {picked.file.size < 1024 * 1024
                  ? `${Math.max(1, Math.round(picked.file.size / 1024))} KB`
                  : `${(picked.file.size / 1024 / 1024).toFixed(1)} MB`}
                ) · uploads when you save
              </span>
            </p>
          )}
          {cropNote && <p className="text-sm text-maize">{cropNote}</p>}
          {removed && !picked && (
            <p className="text-sm text-fg" role="status">The cover will be removed when you save; the event goes back to a default cover.</p>
          )}
          {!shown && !removed && (
            <p className="text-sm text-fg-3">No cover uploaded. Keep the subject centered; no text needed.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => inputRef.current?.click()}>
              <ImageUp aria-hidden="true" />
              {shown ? "Choose a different image" : current ? "Upload a new cover" : "Upload a cover"}
            </button>
            {picked && (
              <button type="button" className={button({ variant: "ghost", size: "sm" })} onClick={clearFile}>
                <X aria-hidden="true" />
                {current && !removed ? "Keep the current cover" : "Cancel"}
              </button>
            )}
            {showCurrent && (
              <button type="button" className={button({ variant: "danger", size: "sm" })} onClick={() => setRemoved(true)}>
                <Trash2 aria-hidden="true" />
                Remove cover
              </button>
            )}
            {removed && !picked && (
              <button type="button" className={button({ variant: "ghost", size: "sm" })} onClick={() => setRemoved(false)}>
                <RotateCcw aria-hidden="true" />
                Undo
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-bad">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
