import type { SVGProps } from "react";

/**
 * Small drawn pieces for the "natural" skin: a dandelion seed head, the yellow bloom,
 * and a wordmark that uses it. Pure SVG, no assets, deterministic (safe to render on
 * the server). Colours come from `currentColor` unless stated.
 */

const SPOKES = 30;
const FAN = [-52, -34, -17, 0, 17, 34, 52];

/** Rounded: server and browser trigonometry differ in the last digits, which breaks hydration. */
function polar(cx: number, cy: number, radius: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    x: round(cx + radius * Math.cos(radians)),
    y: round(cy + radius * Math.sin(radians)),
  };
}

function Seed({ cx, cy, angle, length, tuft }: { cx: number; cy: number; angle: number; length: number; tuft: number }) {
  const tip = polar(cx, cy, length, angle);
  const base = polar(cx, cy, length * 0.16, angle);
  return (
    <g>
      <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} />
      {FAN.map((delta) => {
        const end = polar(tip.x, tip.y, tuft, angle + delta);
        return <line key={delta} x1={tip.x} y1={tip.y} x2={end.x} y2={end.y} />;
      })}
    </g>
  );
}

/** A dandelion seed head with a few seeds drifting off. */
export function TrNaturalDandelion({
  className,
  stem = false,
  ...rest
}: { stem?: boolean } & Omit<SVGProps<SVGSVGElement>, "viewBox" | "children">) {
  return (
    <svg
      viewBox="0 0 240 260"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      strokeLinecap="round"
      aria-hidden
      className={className}
      {...rest}
    >
      <g>
        {Array.from({ length: SPOKES }, (_, index) => (
          <Seed
            key={index}
            cx={110}
            cy={110}
            angle={(360 / SPOKES) * index}
            length={index % 2 === 0 ? 64 : 56}
            tuft={index % 2 === 0 ? 13 : 11}
          />
        ))}
        <circle cx={110} cy={110} r={7} fill="currentColor" stroke="none" opacity={0.85} />
      </g>
      {stem ? <path d="M110 118 C 112 160, 104 200, 108 256" strokeWidth={1.6} /> : null}
      <g opacity={0.6}>
        <Seed cx={206} cy={44} angle={-35} length={20} tuft={5} />
        <Seed cx={226} cy={86} angle={-12} length={14} tuft={4} />
        <Seed cx={190} cy={16} angle={-60} length={12} tuft={3.4} />
      </g>
    </svg>
  );
}

/** The yellow dandelion bloom (the "o" of the Tohumluktan wordmark). */
export function TrNaturalBloom({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <g stroke="#f0c810" strokeWidth={1.7} strokeLinecap="round">
        {Array.from({ length: 18 }, (_, index) => {
          const from = polar(12, 12, 5.2, (360 / 18) * index);
          const to = polar(12, 12, 11, (360 / 18) * index);
          return <line key={index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
        })}
      </g>
      <circle cx={12} cy={12} r={4.6} fill="#e3b400" />
    </svg>
  );
}

/**
 * The store's name as a wordmark, the first "o" drawn as the bloom. Used when the store
 * has no logo file yet; a logo image always wins.
 */
export function TrNaturalWordmark({ name, className }: { name: string; className?: string }) {
  const label = name.toLocaleLowerCase("tr");
  const at = label.indexOf("o");
  if (at < 0) return <span className={className}>{label}</span>;
  return (
    <span className={className} aria-label={name}>
      <span aria-hidden>
        {label.slice(0, at)}
        <TrNaturalBloom className="mx-[0.04em] inline-block h-[0.82em] w-[0.82em] align-[-0.06em]" />
        {label.slice(at + 1)}
      </span>
    </span>
  );
}
