"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { SafeMap } from "@/components/shared/safe-map";

export interface LatLng {
  lat: number;
  lng: number;
}

const ANN_ARBOR: [number, number] = [42.2808, -83.7382];

const pin = L.divIcon({
  html: `<div style="width:22px;height:22px;border-radius:999px 999px 999px 0;transform:rotate(-45deg);background:#0f766e;border:3px solid #fff;box-shadow:0 3px 10px rgba(20,33,61,.4)"></div>`,
  className: "htl-pin",
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

function ClickToPick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) }) });
  return null;
}

/** The card slides in, so Leaflet measures a moving box; re-measure when the box settles or resizes. */
function FitToBox() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [map]);
  return null;
}

function PinMapInner({ value, onPick }: { value: LatLng | null; onPick: (p: LatLng) => void }) {
  return (
    <MapContainer center={value ? [value.lat, value.lng] : ANN_ARBOR} zoom={value ? 15 : 13} scrollWheelZoom className="h-full w-full" attributionControl>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToBox />
      <ClickToPick onPick={onPick} />
      {value && <Marker position={[value.lat, value.lng]} icon={pin} />}
    </MapContainer>
  );
}

/** Tap anywhere to drop a pin (V3 §6). Loaded client-only; crash-safe like the Explore map. */
export default function PinMap(props: { value: LatLng | null; onPick: (p: LatLng) => void }) {
  return <SafeMap failText="The map couldn't load. Pick a campus area or building instead.">{(key) => <PinMapInner key={key} {...props} />}</SafeMap>;
}
