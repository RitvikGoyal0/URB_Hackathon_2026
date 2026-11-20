"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { commuteMatrix } from "@/lib/data";
import type { CampusDestination, Community, Listing, RankedResult } from "@/lib/types";
import { SOURCE_COLOR, SOURCE_META, fmtScore, money, shortDate } from "@/components/shared/format";

export interface MapItem {
  listing: Listing;
  community: Community | undefined;
  result: RankedResult;
}

function routingNote(listingId: string): string {
  const row = commuteMatrix.matrix[listingId];
  if (!row) return "Distances: not computed for this listing";
  const cells = Object.values(row).flatMap((modes) => Object.values(modes ?? {}));
  if (cells.length === 0) return "Distances: not computed for this listing";
  return cells.some((c) => c?.estimated) ? "Distances: est. (straight-line) for some trips" : "Distances: OSRM walking/biking routes";
}

function pinIcon(item: MapItem, selected: boolean) {
  const { listing, result } = item;
  const blocked = result.eligibility === "blocked";
  const color = SOURCE_COLOR[listing.sourceType];
  const size = selected ? 38 : 30;
  const demo = listing.sourceType === "synthetic";
  const bg = demo
    ? `repeating-linear-gradient(-45deg, ${color} 0 4px, #e3a43a 4px 8px)`
    : color;
  const html = `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${bg};opacity:${blocked && !selected ? 0.38 : 1};
    border:${selected ? 3 : 2}px solid #fff;box-shadow:0 4px 12px rgba(20,33,61,${selected ? 0.45 : 0.25});
    display:flex;align-items:center;justify-content:center;color:#fff;font:600 ${selected ? 14 : 12}px var(--font-display),system-ui;
    ${selected ? "outline:3px solid #14213d;outline-offset:1px;" : ""}">${result.rank}</div>`;
  return L.divIcon({ html, className: "htl-pin", iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
}

function destinationIcon(d: CampusDestination) {
  const html = `<div style="display:flex;align-items:center;gap:4px;transform:translate(-9px,-9px)">
    <div style="width:18px;height:18px;transform:rotate(45deg);background:#14213d;border:2px solid #fff;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>
    <span style="background:#fff;border-radius:6px;padding:1px 6px;font:600 11px var(--font-body),system-ui;color:#14213d;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.15)">${d.shortName}</span>
  </div>`;
  return L.divIcon({ html, className: "htl-pin", iconSize: [18, 18], iconAnchor: [0, 0] });
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const lat = target?.[0];
  const lng = target?.[1];
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    // Only move the map when the selected home is off-screen, so hovering cards doesn't make it jump.
    if (!map.getBounds().pad(-0.1).contains([lat, lng])) map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [map, lat, lng]);
  return null;
}

function ExploreMapInner({
  items,
  destinations,
  selectedId,
  onSelect,
  center,
}: {
  items: MapItem[];
  destinations: CampusDestination[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  center: [number, number];
}) {
  // Several floor plans can share one community address; fan them out slightly so every pin is clickable.
  const positions = useMemo(() => {
    const seen = new Map<string, number>();
    const out = new Map<string, [number, number]>();
    for (const it of items) {
      if (!it.community) continue;
      const k = it.community.id;
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      out.set(it.listing.id, [it.community.lat + n * 0.0003, it.community.lng + n * 0.00045]);
    }
    return out;
  }, [items]);
  const target = selectedId ? (positions.get(selectedId) ?? null) : null;
  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full" attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo target={target} />
      {destinations.map((d) => (
        <Marker key={d.id} position={[d.lat, d.lng]} icon={destinationIcon(d)} keyboard={false}>
          <Tooltip direction="top" offset={[0, -10]}>
            {d.name} (campus destination)
          </Tooltip>
        </Marker>
      ))}
      {items.map((item) => {
        const pos = positions.get(item.listing.id);
        if (!pos) return null;
        const { listing, result } = item;
        const pp = result.perMember[0]?.perPersonRent ?? null;
        const isSel = listing.id === selectedId;
        return (
          <Marker
            key={listing.id}
            position={pos}
            icon={pinIcon(item, isSel)}
            zIndexOffset={isSel ? 1000 : result.eligibility === "blocked" ? -100 : 0}
            eventHandlers={{ click: () => onSelect(listing.id) }}
            title={`#${result.rank} ${listing.name}`}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#14213d" }}>
                  #{result.rank} {listing.name}
                </div>
                <div style={{ fontSize: 12, marginTop: 4, color: SOURCE_COLOR[listing.sourceType], fontWeight: 600 }}>
                  {listing.sourceType === "synthetic"
                    ? "DEMO — fictional listing"
                    : `${SOURCE_META[listing.sourceType].label} · ${SOURCE_META[listing.sourceType].status} ${shortDate(listing.provenance.observedAt)}`}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Group score {fmtScore(result.groupScore)} · {pp === null ? "Contact for pricing" : `${money(pp)}/person`}
                  {result.eligibility === "blocked" ? " · blocked" : ""}
                </div>
                <div style={{ fontSize: 11.5, marginTop: 4, color: "#5d6472" }}>{routingNote(listing.id)}</div>
                <Link href={`/listing/${listing.id}`} style={{ display: "inline-block", marginTop: 6, fontSize: 12, fontWeight: 600, color: "#0b7a6c" }}>
                  Open details
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

type MapProps = Parameters<typeof ExploreMapInner>[0];

/**
 * Next 16 (cacheComponents) keeps visited routes alive in a hidden <Activity> and re-runs their
 * effects when you navigate back. react-leaflet then re-initialises Leaflet on the old container
 * ("Map container is being reused by another instance") and the whole route crashed.
 * Fix: the map only renders while this component's effect is live, and every activation gets a
 * fresh key → a brand-new container element and Leaflet instance. The boundary below catches any
 * remaining Leaflet error, retries once with a fresh instance, and otherwise degrades to a message
 * so the list (and the page) always keeps working.
 */
export default function ExploreMap(props: MapProps) {
  const generation = useRef(0);
  const [mountKey, setMountKey] = useState<number | null>(null);
  useEffect(() => {
    generation.current += 1;
    setMountKey(generation.current);
    return () => setMountKey(null);
  }, []);
  if (mountKey === null) return <MapPlaceholder text="Loading map…" />;
  return (
    <MapErrorBoundary key={mountKey}>
      {(attempt) => <ExploreMapInner key={`${mountKey}-${attempt}`} {...props} />}
    </MapErrorBoundary>
  );
}

function MapPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#e8ebe4] px-6 text-center text-[13px] text-muted-foreground">
      {text}
    </div>
  );
}

class MapErrorBoundary extends Component<{ children: (attempt: number) => ReactNode }, { attempt: number; failed: boolean }> {
  state = { attempt: 0, failed: false };
  static getDerivedStateFromError() {
    return null;
  }
  componentDidCatch(error: unknown) {
    console.warn("[map] recovered from Leaflet error:", error instanceof Error ? error.message : error);
    this.setState((s) => (s.attempt < 1 ? { attempt: s.attempt + 1, failed: false } : { attempt: s.attempt, failed: true }));
  }
  render() {
    if (this.state.failed) return <MapPlaceholder text="The map couldn't load. The list still works." />;
    return this.props.children(this.state.attempt);
  }
}
