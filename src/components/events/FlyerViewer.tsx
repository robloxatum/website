"use client";

import { Maximize2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { button } from "@/components/ui/styles";

/**
 * An event flyer at its natural aspect ratio (never cropped), under a heading
 * row with a "Full screen" button. Tapping the flyer or that button opens a
 * full-screen view in a native <dialog> (Escape, the X or tapping outside
 * closes it). Nothing sits on top of the flyer image itself.
 */
export function FlyerViewer({
  src,
  width,
  height,
  alt,
  sizes = "(min-width: 640px) 576px, calc(100vw - 40px)",
  eager = false,
  heading,
  headingId,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  sizes?: string;
  /** Load right away (the flyer is above the fold next to the event details on desktop). */
  eager?: boolean;
  /** Heading shown left of the Full screen button (an h2). */
  heading: string;
  headingId?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const openFull = () => {
    setOpen(true);
    dialogRef.current?.showModal();
  };

  return (
    <>
      {/* Heading and button line up with the flyer, which is centered at up to max-w-xl. */}
      <div className="mx-auto max-w-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={headingId} className="text-xl text-fg">
            {heading}
          </h2>
          <button
            type="button"
            onClick={openFull}
            title="Open full screen"
            aria-label={`Open ${alt} full screen`}
            className={button({ variant: "ghost", size: "sm", className: "-mr-2" })}
          >
            <Maximize2 aria-hidden="true" />
            Full screen
          </button>
        </div>
        <button
          type="button"
          onClick={openFull}
          className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-line/60 bg-bg-2"
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
        </button>
      </div>

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
