"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A listing's photo, or an honest neutral placeholder (V3 §9.3): no illustrated house on a real
 * address. Photos are team-supplied files under /public/listings/<id>/ (see docs/listing-photos.md).
 */
export function ListingPhoto({ src, alt, credit, className, sizes = "(min-width: 1024px) 33vw, 100vw", priority }: {
  src?: string | null;
  alt: string;
  credit?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <PhotoPlaceholder className={className} error={failed} />;
  return (
    <div className={cn("relative overflow-hidden bg-secondary", className)}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" onError={() => setFailed(true)} />
      {credit && <span className="absolute right-2 bottom-2 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] text-white">{credit}</span>}
    </div>
  );
}

export function PhotoPlaceholder({ className, error }: { className?: string; error?: boolean }) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-1.5 bg-[#eceee9] text-center text-muted-foreground", className)}
      role="img"
      aria-label={error ? "Photo couldn't load" : "Photo coming soon"}
    >
      <ImageOff className="size-6 opacity-60" aria-hidden />
      <span className="text-[12.5px] font-medium">{error ? "Photo couldn't load" : "Photo coming soon"}</span>
    </div>
  );
}
