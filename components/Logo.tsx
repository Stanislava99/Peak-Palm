import { brand } from "@/lib/brand";

type Tone = "dark" | "light";

const palette: Record<Tone, { ink: string; cut: string; gold: string }> = {
  dark: { ink: "#1f3a30", cut: "#f3eee5", gold: "#b8975a" },
  light: { ink: "#f3eee5", cut: "#1f3a30", gold: "#c9ab6f" },
};

const FROND =
  "M0 0 C14 -16 36 -17 54 -1 L46 -3.5 L48 3 L40 -5.5 L40 2.5 L32 -7.5 L31 1 L24 -8 L21 0 L16 -7 L12 -0.5 L8 -5 Z";

const fronds = [
  "scale(-1 1) rotate(-70) scale(0.63)",
  "rotate(-58) scale(0.69)",
  "scale(-1 1) rotate(-30) scale(0.71)",
  "rotate(-18) scale(0.67)",
  "scale(-1 1) rotate(12) scale(0.57)",
  "rotate(26) scale(0.55)",
];

/**
 * The Peak & Palm monogram: a serif P cut by a mountain peak,
 * a setting sun behind the bowl, and a palm on the right.
 * `cut` should match whatever the mark sits on, so the outlines read.
 */
export function Mark({
  tone = "dark",
  cut,
  size,
  className,
  title,
}: {
  tone?: Tone;
  cut?: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const c = palette[tone];
  const gap = cut ?? c.cut;
  return (
    <svg
      viewBox="0 0 132 120"
      width={size}
      height={size ? (size * 120) / 132 : undefined}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <circle cx="74" cy="26" r="15" fill={c.gold} />
      <g fill={c.ink}>
        <path
          fillRule="evenodd"
          d="M40 18 H64 C84 18 96 30 96 45 C96 61 84 71 64 71 H40 V64 H61 C75 64 82 56 82 45 C82 34 75 25 61 25 H40 Z"
        />
        <path d="M20 18 H44 V22 H42 V92 C42 95.5 45 97 52 97 V100 H20 V97 C26 97 30 95.5 30 92 V24 C30 22 27 21.5 20 21.5 Z" />
      </g>
      <path
        d="M6 94 L40 50 L46 57 L55 44 L76 74 L70 74 L60 64 L66 80 L48 66 L36 82 L30 74 Z"
        fill={c.ink}
        stroke={gap}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path fill={gap} d="M50 51 L55 44 L61.5 53.2 L58 51 L55.5 54 L53 51 Z" />
      <path d="M8 98 C30 88 52 90 74 84" fill="none" stroke={c.ink} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M102 48 C102 66 100 84 96 100" stroke={gap} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M102 48 C102 66 100 84 96 100" stroke={c.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      <g fill={c.ink} stroke={gap} strokeWidth="1.4" strokeLinejoin="round" transform="translate(102 48)">
        {fronds.map((t) => (
          <path key={t} d={FROND} transform={t} />
        ))}
      </g>
    </svg>
  );
}

/** Wordmark: PEAK & PALM over a ruled VILLAS line, as on the brand board. */
export function Wordmark({ tone = "dark", compact = false }: { tone?: Tone; compact?: boolean }) {
  return (
    <span className={`wordmark wordmark-${tone}${compact ? " is-compact" : ""}`}>
      <span className="wordmark-name">
        Peak <i>&amp;</i> Palm
      </span>
      <span className="wordmark-sub">
        <b aria-hidden="true" />
        Villas
        <b aria-hidden="true" />
      </span>
    </span>
  );
}

export function Lockup({
  tone = "dark",
  layout = "row",
  cut,
}: {
  tone?: Tone;
  layout?: "row" | "stack";
  cut?: string;
}) {
  return (
    <span className={`lockup lockup-${layout}`} aria-label={brand.name}>
      <Mark tone={tone} cut={cut} className="lockup-mark" />
      <Wordmark tone={tone} compact={layout === "row"} />
    </span>
  );
}
