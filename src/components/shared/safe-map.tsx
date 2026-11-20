"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Shared Leaflet crash fix (V3 §3.1). Under React <Activity>, a hidden route keeps its fiber tree
 * but runs effect cleanups; react-leaflet's cleanup calls map.remove() and the re-shown map then
 * crashes ("Map container is being reused by another instance").
 * Fix: render the map only while this component's effect is live, with a fresh key on every
 * activation (new container element + new Leaflet instance), inside a boundary that retries once
 * and otherwise shows a message, so the page around the map always keeps working.
 */
export function SafeMap({ children, failText, className }: { children: (key: string) => ReactNode; failText: string; className?: string }) {
  const generation = useRef(0);
  const [mountKey, setMountKey] = useState<number | null>(null);
  useEffect(() => {
    generation.current += 1;
    setMountKey(generation.current);
    return () => setMountKey(null);
  }, []);
  if (mountKey === null) return <MapPlaceholder text="Loading map…" className={className} />;
  return (
    <MapErrorBoundary key={mountKey} failText={failText} className={className}>
      {(attempt) => children(`${mountKey}-${attempt}`)}
    </MapErrorBoundary>
  );
}

export function MapPlaceholder({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`flex h-full w-full items-center justify-center bg-[#e8ebe4] px-6 text-center text-[13px] text-muted-foreground ${className ?? ""}`}>
      {text}
    </div>
  );
}

class MapErrorBoundary extends Component<
  { children: (attempt: number) => ReactNode; failText: string; className?: string },
  { attempt: number; failed: boolean }
> {
  state = { attempt: 0, failed: false };
  static getDerivedStateFromError() {
    return null;
  }
  componentDidCatch(error: unknown) {
    console.warn("[map] recovered from Leaflet error:", error instanceof Error ? error.message : error);
    this.setState((s) => (s.attempt < 1 ? { attempt: s.attempt + 1, failed: false } : { attempt: s.attempt, failed: true }));
  }
  render() {
    if (this.state.failed) return <MapPlaceholder text={this.props.failText} className={this.props.className} />;
    return this.props.children(this.state.attempt);
  }
}
