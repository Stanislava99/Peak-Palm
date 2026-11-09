import { brand } from "@/lib/brand";

type Tone = "dark" | "light";

/** Emblem files traced from the brand board: navy S for light backgrounds, ivory S for navy/photos. */
const MARK_SRC: Record<Tone, string> = { dark: "/brand/mark.svg", light: "/brand/mark-light.svg" };
/** Width ÷ height of the emblem artwork. */
export const MARK_RATIO = 1527 / 1106;

/**
 * The Sea & Ski emblem: an S whose upper bowl holds a mountain and a skier on the slope,
 * a sand sun behind its top, and sea waves sweeping through its lower curve.
 * Served as a cached SVG file (it is detailed artwork, so it isn't inlined on every page).
 * `cut` is accepted for compatibility and ignored.
 */
export function Mark({
  tone = "dark",
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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={MARK_SRC[tone]}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      width={size ?? 138}
      height={Math.round((size ?? 138) / MARK_RATIO)}
      className={className}
      decoding="async"
    />
  );
}

/** Wordmark: SEA & SKI over a ruled VILLAS line, as on the brand board. */
export function Wordmark({ tone = "dark", compact = false }: { tone?: Tone; compact?: boolean }) {
  return (
    <span className={`wordmark wordmark-${tone}${compact ? " is-compact" : ""}`}>
      <span className="wordmark-name">
        Sea <i>&amp;</i> Ski
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
