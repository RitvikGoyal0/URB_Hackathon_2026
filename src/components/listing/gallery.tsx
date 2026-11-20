"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListingPhotoCredit } from "@/lib/data";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PhotoPlaceholder } from "@/components/shared/listing-photo";

/**
 * Listing gallery (V3 §9.3): main image with a thumbnail strip, prev/next buttons, arrow keys,
 * swipe, full-screen view, a skeleton while loading, an error fallback, and a credit on every
 * image. With no photos it's the neutral "Photo coming soon" block.
 */
export function Gallery({ photos, name, className }: { photos: ListingPhotoCredit[]; name: string; className?: string }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  if (photos.length === 0) return <PhotoPlaceholder className={cn("aspect-[16/10] w-full rounded-[24px]", className)} />;

  const n = photos.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  const cur = photos[Math.min(i, n - 1)];

  return (
    <div className={className}>
      <Slide photo={cur} name={name} index={i} total={n} onPrev={() => go(-1)} onNext={() => go(1)} onExpand={() => setFull(true)} className="aspect-[16/10] rounded-[24px]" sizes="(min-width: 1024px) 55vw, 100vw" priority />
      {n > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Photos">
          {photos.map((p, j) => (
            <li key={p.src} className="shrink-0">
              <button
                type="button"
                aria-label={`Photo ${j + 1} of ${n}`}
                aria-current={j === i}
                onClick={() => setI(j)}
                className={cn(
                  "relative block h-14 w-20 overflow-hidden rounded-xl border-2 bg-secondary focus-visible:ring-3 focus-visible:ring-teal/40 focus-visible:outline-none",
                  j === i ? "border-ink" : "border-transparent opacity-75 hover:opacity-100",
                )}
              >
                <Image src={p.src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-w-[min(96vw,1400px)] bg-black p-2 text-white ring-0 sm:max-w-[min(96vw,1400px)]">
          <DialogTitle className="sr-only">
            {name}: photo {i + 1} of {n}
          </DialogTitle>
          <Slide photo={cur} name={name} index={i} total={n} onPrev={() => go(-1)} onNext={() => go(1)} className="h-[80vh] rounded-lg" sizes="96vw" contain />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Slide({
  photo,
  name,
  index,
  total,
  onPrev,
  onNext,
  onExpand,
  className,
  sizes,
  priority,
  contain,
}: {
  photo: ListingPhotoCredit;
  name: string;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onExpand?: () => void;
  className?: string;
  sizes: string;
  priority?: boolean;
  contain?: boolean;
}) {
  // Keyed by src so loading/error state resets per image.
  const [state, setState] = useState<{ src: string; loaded: boolean; failed: boolean }>({ src: photo.src, loaded: false, failed: false });
  const s = state.src === photo.src ? state : { src: photo.src, loaded: false, failed: false };
  const touch = useRef<number | null>(null);
  const many = total > 1;

  return (
    <figure
      className={cn("group relative overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-teal/40", contain ? "bg-black" : "bg-secondary", className)}
      tabIndex={many ? 0 : undefined}
      aria-roledescription="carousel"
      aria-label={`${name} photos`}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          if (e.key === "ArrowLeft") onPrev();
          else onNext();
        }
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") touch.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (touch.current === null || !many) return;
        const dx = e.clientX - touch.current;
        touch.current = null;
        if (dx > 40) onPrev();
        else if (dx < -40) onNext();
      }}
    >
      {s.failed ? (
        <PhotoPlaceholder error className="absolute inset-0" />
      ) : (
        <>
          {!s.loaded && <div className="absolute inset-0 animate-pulse bg-[#e3e6e1]" aria-hidden />}
          <Image
            key={photo.src}
            src={photo.src}
            alt={`${name}: ${photo.type} photo ${index + 1} of ${total}`}
            fill
            sizes={sizes}
            priority={priority}
            draggable={false}
            className={cn(contain ? "object-contain" : "object-cover", "transition-opacity", s.loaded ? "opacity-100" : "opacity-0")}
            onLoad={() => setState({ src: photo.src, loaded: true, failed: false })}
            onError={() => setState({ src: photo.src, loaded: false, failed: true })}
          />
        </>
      )}
      <figcaption className="absolute bottom-2 left-2 max-w-[75%] truncate rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] text-white">{photo.attribution}</figcaption>
      {many && (
        <>
          <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11.5px] text-white tabular-nums">
            {index + 1} / {total}
          </span>
          <button type="button" aria-label="Previous photo" onClick={onPrev} className="absolute top-1/2 left-2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" aria-label="Next photo" onClick={onNext} className="absolute top-1/2 right-2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow">
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </>
      )}
      {onExpand && (
        <button type="button" aria-label="View full screen" onClick={onExpand} className="absolute right-2 bottom-2 inline-flex size-9 items-center justify-center rounded-full bg-white/90 text-ink shadow">
          <Expand className="size-4" aria-hidden />
        </button>
      )}
    </figure>
  );
}
