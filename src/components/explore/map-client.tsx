"use client";

import dynamic from "next/dynamic";

/** Leaflet touches `window`, so the map only loads in the browser. */
export const ExploreMapClient = dynamic(() => import("./explore-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#e8ebe4] text-[13px] text-muted-foreground">Loading map…</div>
  ),
});
