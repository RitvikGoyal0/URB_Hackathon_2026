import { cn } from "@/lib/utils";
import { fmtScore, scoreHex } from "./format";

export interface RingMember {
  id: string;
  name: string;
  hex: string;
  score: number | null;
}

/**
 * Group score ring. The arc is the group score; each member sits on the track as a dot at
 * their own score, so the spread between the average and the least-satisfied member is visible.
 */
export function ScoreRing({
  score,
  members = [],
  size = 76,
  stroke = 7,
  dimmed = false,
  label,
  className,
}: {
  score: number | null;
  members?: RingMember[];
  size?: number;
  stroke?: number;
  dimmed?: boolean;
  label?: string;
  className?: string;
}) {
  const r = (size - stroke) / 2 - 3;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = dimmed ? "#9aa0a8" : scoreHex(score);
  const pos = (s: number) => {
    const a = (Math.max(0, Math.min(100, s)) / 100) * 2 * Math.PI - Math.PI / 2;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  const title =
    label ??
    `Group score ${fmtScore(score)}${members.length ? `. ${members.map((m) => `${m.name} ${fmtScore(m.score)}`).join(", ")}` : ""}`;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={title}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#e5e8e1" strokeWidth={stroke} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ transition: "stroke-dasharray 500ms ease" }}
        />
        {members.map((m) =>
          m.score === null ? null : (
            <circle
              key={m.id}
              cx={pos(m.score).x}
              cy={pos(m.score).y}
              r={Math.max(2.5, stroke / 2.2)}
              fill={dimmed ? "#c5c9cf" : m.hex}
              stroke="#fff"
              strokeWidth={1.5}
              style={{ transition: "cx 500ms ease, cy 500ms ease" }}
            />
          ),
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display font-semibold tabular-nums" style={{ fontSize: size * 0.3, color }}>
          {fmtScore(score)}
        </span>
      </div>
    </div>
  );
}
