"use client";

import { ImageUp, RotateCcw, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { button, label } from "@/components/ui/styles";
import { type Flyer, flyerFileError, flyerUrl } from "@/lib/flyers";

/**
 * Optional flyer image on the event form. The file input is named "flyer_file";
 * the form's action uploads it to Storage before saving (see EventForm).
 * "flyer_action" tells saveEvent to keep or remove the current flyer.
 */
export function FlyerField({ current, title }: { current: Flyer | null; title?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  // The chosen file and its blob: preview URL, created together in the change handler.
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
  const file = picked?.file ?? null;
  const preview = picked?.preview ?? null;
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const helpId = useId();

  // Free each preview URL once it's replaced or the form goes away.
  useEffect(() => (preview ? () => URL.revokeObjectURL(preview) : undefined), [preview]);

  function clearFile() {
    setPicked(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const showCurrent = current && !file && !removed;

  return (
    <div>
      <p className={label} id={`${helpId}-label`}>
        Flyer <span className="font-normal text-fg-3">(optional)</span>
      </p>
      <p id={helpId} className="-mt-1 mb-3 text-sm text-fg-2">
        PNG or JPG, up to 5 MB. Shown full-size on the event page. Event cards keep the category art.
      </p>

      <input
        ref={inputRef}
        type="file"
        name="flyer_file"
        accept="image/png,image/jpeg"
        className="sr-only"
        tabIndex={-1}
        aria-labelledby={`${helpId}-label`}
        aria-describedby={helpId}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          const problem = f ? flyerFileError(f) : null;
          setError(problem);
          if (problem || !f) return clearFile();
          setPicked({ file: f, preview: URL.createObjectURL(f) });
          setRemoved(false);
        }}
      />
      <input type="hidden" name="flyer_action" value={removed && !file ? "remove" : "keep"} />

      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-line bg-bg-2/50 p-4 sm:flex-row sm:items-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob: preview before upload
          <img src={preview} alt="New flyer preview" className="max-h-56 w-auto self-start rounded-lg object-contain" />
        ) : showCurrent ? (
          <Image
            src={flyerUrl(current.path)}
            alt={`Flyer for ${title || "this event"}`}
            width={current.width}
            height={current.height}
            sizes="160px"
            className="h-auto max-h-56 w-auto max-w-40 self-start rounded-lg object-contain"
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {file && (
            <p className="text-sm text-fg">
              <span className="font-semibold break-all">{file.name}</span>{" "}
              <span className="text-fg-3">({file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}) · uploads when you save</span>
            </p>
          )}
          {removed && !file && (
            <p className="text-sm text-fg" role="status">The flyer will be removed when you save.</p>
          )}
          {!file && !current && !removed && <p className="text-sm text-fg-3">No flyer yet.</p>}

          <div className="flex flex-wrap gap-2">
            <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => inputRef.current?.click()}>
              <ImageUp aria-hidden="true" />
              {file || showCurrent ? "Choose a different image" : current ? "Upload a new flyer" : "Upload a flyer"}
            </button>
            {file && (
              <button type="button" className={button({ variant: "ghost", size: "sm" })} onClick={clearFile}>
                <X aria-hidden="true" />
                {current && !removed ? "Keep the current flyer" : "Cancel"}
              </button>
            )}
            {showCurrent && (
              <button type="button" className={button({ variant: "danger", size: "sm" })} onClick={() => setRemoved(true)}>
                <Trash2 aria-hidden="true" />
                Remove flyer
              </button>
            )}
            {removed && !file && (
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
