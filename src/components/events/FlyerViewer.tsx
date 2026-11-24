"use client";

import { Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

/**
 * An event flyer at its natural aspect ratio (never cropped). Tapping it opens
 * a full-screen view in a native <dialog> (Escape, the X or tapping outside closes it).
 */
export function FlyerViewer({ src, width, height, alt }: { src: string; width: number; height: number; alt: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
        className="group relative mx-auto block w-full max-w-xl cursor-zoom-in overflow-hidden rounded-xl border border-line/60 bg-bg-2"
        aria-label={`${alt}. Open full screen`}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(min-width: 640px) 576px, calc(100vw - 40px)"
          className="h-auto w-full"
        />
        <span className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-bg/85 px-2.5 py-1.5 text-xs font-semibold text-fg backdrop-blur transition-colors duration-150 group-hover:bg-maize group-hover:text-navy">
          <Maximize2 aria-hidden="true" className="size-3.5" />
          Tap to open full screen
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-label={alt}
        onClose={() => setOpen(false)}
        // Clicks on the backdrop land on the <dialog> itself.
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90"
      >
        {open && (
          <div className="relative size-full" onClick={() => dialogRef.current?.close()}>
            <Image src={src} alt={alt} fill sizes="100vw" className="object-contain p-2 sm:p-6" />
          </div>
        )}
        <button
          type="button"
          autoFocus
          onClick={() => dialogRef.current?.close()}
          className="fixed top-[max(12px,env(safe-area-inset-top))] right-3 grid size-12 place-items-center rounded-full bg-bg/80 text-fg backdrop-blur hover:bg-maize hover:text-navy"
          aria-label="Close flyer"
        >
          <X aria-hidden="true" className="size-6" />
        </button>
      </dialog>
    </>
  );
}
