"use client";

import { Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

/**
 * An event flyer at its natural aspect ratio (never cropped). Tapping it opens
 * a full-screen view in a native <dialog> (Escape, the X or tapping outside closes it).
 */
export function FlyerViewer({
  src,
  width,
  height,
  alt,
  sizes = "(min-width: 640px) 576px, calc(100vw - 40px)",
  eager = false,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  sizes?: string;
  /** Load right away (the flyer is above the fold next to the event details on desktop). */
  eager?: boolean;
}) {
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
        title="Open full screen"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          loading={eager ? "eager" : undefined}
          className="h-auto w-full"
        />
        {/* Small icon in the top-right corner, so it never covers the bottom of a flyer
            (where the QR code and location usually are). The button's label says what it does. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-2 right-2 grid size-8 place-items-center rounded-full border border-line/60 bg-bg/80 text-fg shadow-card backdrop-blur transition-colors duration-150 group-hover:bg-maize group-hover:text-navy group-focus-visible:bg-maize group-focus-visible:text-navy"
        >
          <Maximize2 className="size-4" />
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
