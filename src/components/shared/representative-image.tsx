import { cn } from "@/lib/utils";
import type { HousingType } from "@/lib/types";

type Scene = "exterior" | "kitchen" | "bedroom";

/**
 * Neutral placeholder art (spec §5.4: no hotlinked listing photos).
 * Always labelled "Representative image" so nobody mistakes it for the actual unit.
 */
export function RepresentativeImage({
  housingType,
  scene = "exterior",
  className,
  showLabel = true,
  seed = 0,
}: {
  housingType: HousingType;
  scene?: Scene;
  className?: string;
  showLabel?: boolean;
  seed?: number;
}) {
  const palettes = [
    ["#dfe7e1", "#c3d4cb", "#14213d"],
    ["#e4e6ee", "#cbd1e0", "#14213d"],
    ["#ece7dc", "#d9cfbb", "#14213d"],
    ["#e1e9ec", "#c5d6dc", "#14213d"],
  ];
  const [bg, mid, ink] = palettes[seed % palettes.length];
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: bg }}>
      <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax slice" aria-hidden>
        {scene === "exterior" && <Exterior type={housingType} mid={mid} ink={ink} />}
        {scene === "kitchen" && <Kitchen mid={mid} ink={ink} />}
        {scene === "bedroom" && <Bedroom mid={mid} ink={ink} />}
      </svg>
      {showLabel && (
        <span className="absolute bottom-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[10.5px] font-medium text-charcoal backdrop-blur">
          Representative image
        </span>
      )}
    </div>
  );
}

function Exterior({ type, mid, ink }: { type: HousingType; mid: string; ink: string }) {
  const ground = <rect x="0" y="170" width="320" height="30" fill={mid} />;
  const tree = (x: number) => (
    <g key={x}>
      <rect x={x - 2} y="140" width="4" height="30" fill={ink} opacity="0.5" />
      <circle cx={x} cy="132" r="16" fill="#9fbfae" />
    </g>
  );
  if (type === "high_rise") {
    return (
      <g>
        {ground}
        <rect x="110" y="30" width="100" height="140" rx="4" fill="#fff" stroke={ink} strokeOpacity="0.15" />
        {Array.from({ length: 7 }).map((_, r) =>
          Array.from({ length: 4 }).map((__, col) => (
            <rect key={`${r}-${col}`} x={122 + col * 22} y={42 + r * 17} width="14" height="10" rx="1.5" fill={ink} opacity={0.14 + ((r + col) % 3) * 0.06} />
          )),
        )}
        <rect x="60" y="90" width="46" height="80" rx="3" fill="#f4f5f2" stroke={ink} strokeOpacity="0.12" />
        <rect x="214" y="80" width="50" height="90" rx="3" fill="#f4f5f2" stroke={ink} strokeOpacity="0.12" />
        {tree(40)}
        {tree(285)}
      </g>
    );
  }
  if (type === "garden_apartment" || type === "co_op") {
    return (
      <g>
        {ground}
        <rect x="50" y="85" width="220" height="85" rx="4" fill="#fff" stroke={ink} strokeOpacity="0.15" />
        <path d="M44 88 L160 52 L276 88 Z" fill={ink} opacity="0.82" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={66 + i * 40} y="100" width="22" height="18" rx="2" fill={ink} opacity="0.16" />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={`b${i}`} x={66 + i * 40} y="132" width="22" height="18" rx="2" fill={ink} opacity="0.16" />
        ))}
        {tree(26)}
        {tree(296)}
      </g>
    );
  }
  if (type === "studio") {
    return (
      <g>
        {ground}
        <rect x="95" y="70" width="130" height="100" rx="4" fill="#fff" stroke={ink} strokeOpacity="0.15" />
        <rect x="112" y="88" width="40" height="30" rx="2" fill={ink} opacity="0.16" />
        <rect x="168" y="88" width="40" height="30" rx="2" fill={ink} opacity="0.16" />
        <rect x="145" y="132" width="30" height="38" rx="2" fill={ink} opacity="0.7" />
        {tree(60)}
      </g>
    );
  }
  // house, duplex, townhome, ranch
  const units = type === "duplex" ? 2 : type === "townhome" ? 3 : 1;
  const w = type === "ranch" ? 200 : units === 1 ? 140 : 210;
  const x0 = 160 - w / 2;
  const roofTop = type === "ranch" ? 95 : 55;
  return (
    <g>
      {ground}
      <rect x={x0} y={type === "ranch" ? 115 : 95} width={w} height={type === "ranch" ? 55 : 75} rx="3" fill="#fff" stroke={ink} strokeOpacity="0.15" />
      <path d={`M${x0 - 8} ${type === "ranch" ? 118 : 98} L160 ${roofTop} L${x0 + w + 8} ${type === "ranch" ? 118 : 98} Z`} fill={ink} opacity="0.82" />
      {Array.from({ length: units }).map((_, i) => {
        const ux = x0 + (w / units) * i;
        const uw = w / units;
        return (
          <g key={i}>
            <rect x={ux + uw / 2 - 9} y="140" width="18" height="30" rx="2" fill={ink} opacity="0.7" />
            <rect x={ux + 12} y={type === "ranch" ? 128 : 108} width="20" height="16" rx="2" fill={ink} opacity="0.16" />
            <rect x={ux + uw - 32} y={type === "ranch" ? 128 : 108} width="20" height="16" rx="2" fill={ink} opacity="0.16" />
          </g>
        );
      })}
      {tree(34)}
      {tree(290)}
    </g>
  );
}

function Kitchen({ mid, ink }: { mid: string; ink: string }) {
  return (
    <g>
      <rect x="0" y="120" width="320" height="80" fill={mid} />
      <rect x="40" y="40" width="240" height="40" rx="3" fill="#fff" stroke={ink} strokeOpacity="0.12" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={48 + i * 58} y="46" width="50" height="28" rx="2" fill={ink} opacity="0.07" />
      ))}
      <rect x="40" y="110" width="240" height="60" rx="3" fill="#fff" stroke={ink} strokeOpacity="0.12" />
      <rect x="30" y="104" width="260" height="8" rx="2" fill={ink} opacity="0.75" />
      <circle cx="110" cy="100" r="7" fill={ink} opacity="0.25" />
      <circle cx="132" cy="100" r="7" fill={ink} opacity="0.25" />
      <rect x="190" y="88" width="30" height="16" rx="3" fill="#9fbfae" />
    </g>
  );
}

function Bedroom({ mid, ink }: { mid: string; ink: string }) {
  return (
    <g>
      <rect x="0" y="140" width="320" height="60" fill={mid} />
      <rect x="200" y="40" width="70" height="60" rx="3" fill="#fff" stroke={ink} strokeOpacity="0.15" />
      <line x1="235" y1="40" x2="235" y2="100" stroke={ink} strokeOpacity="0.15" />
      <rect x="40" y="110" width="150" height="45" rx="6" fill="#fff" stroke={ink} strokeOpacity="0.15" />
      <rect x="40" y="88" width="20" height="67" rx="4" fill={ink} opacity="0.75" />
      <rect x="66" y="100" width="40" height="16" rx="6" fill="#9fbfae" />
      <rect x="220" y="120" width="50" height="35" rx="3" fill="#fff" stroke={ink} strokeOpacity="0.15" />
    </g>
  );
}
